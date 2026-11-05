import type { Hallazgo } from "../dominio/hallazgo";
import { detectarCargos, entidadesDeTokens, partirEnFragmentos } from "../dominio/ner";
import type { EstadoModeloNer, ProgresoNer, WorkerNer } from "./protocolo-ner";

/** Administra el Worker del modelo. Nunca lanza: si algo falla, la capa queda apagada. */
export interface ClienteNer {
  cargar(alProgreso?: (progreso: ProgresoNer) => void): Promise<boolean>;
  analizar(texto: string): Promise<Hallazgo[]>;
  estado(): EstadoModeloNer;
}

/** Sin noticias del Worker durante este tiempo, la carga se da por perdida. */
const INACTIVIDAD_MAXIMA_MS = 120_000;
const ANALISIS_BASE_MS = 20_000;
const ANALISIS_POR_FRAGMENTO_MS = 10_000;

interface Pendiente {
  fragmentos: { inicio: number; texto: string }[];
  texto: string;
  resolver: (hallazgos: Hallazgo[]) => void;
  temporizador: ReturnType<typeof setTimeout>;
}

export const crearClienteNer = (crearWorker: () => WorkerNer): ClienteNer => {
  let estado: EstadoModeloNer = "inactivo";
  let worker: WorkerNer | null = null;
  let carga: Promise<boolean> | null = null;
  let terminarCarga: ((exito: boolean) => void) | null = null;
  let temporizadorCarga: ReturnType<typeof setTimeout> | undefined;
  let siguienteId = 1;
  const pendientes = new Map<number, Pendiente>();
  const oyentes = new Set<(progreso: ProgresoNer) => void>();

  const avisar = (porcentaje: number) => {
    for (const oyente of oyentes) oyente({ estado, porcentaje });
  };

  const fallar = () => {
    estado = "error";
    clearTimeout(temporizadorCarga);
    if (worker) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      worker = null;
    }
    for (const pendiente of pendientes.values()) {
      clearTimeout(pendiente.temporizador);
      pendiente.resolver([]);
    }
    pendientes.clear();
    avisar(0);
    oyentes.clear();
    terminarCarga?.(false);
    terminarCarga = null;
    carga = null;
  };

  const vigilarCarga = () => {
    clearTimeout(temporizadorCarga);
    temporizadorCarga = setTimeout(fallar, INACTIVIDAD_MAXIMA_MS);
  };

  const iniciar = () =>
    new Promise<boolean>((resolver) => {
      terminarCarga = resolver;
      estado = "cargando";
      avisar(0);
      try {
        worker = crearWorker();
      } catch {
        fallar();
        return;
      }
      worker.onerror = fallar;
      worker.onmessage = ({ data }) => {
        if (data.tipo === "progreso") {
          vigilarCarga();
          avisar(data.porcentaje);
        } else if (data.tipo === "listo") {
          clearTimeout(temporizadorCarga);
          estado = "listo";
          avisar(100);
          oyentes.clear();
          terminarCarga?.(true);
          terminarCarga = null;
          carga = null;
        } else if (data.tipo === "error") {
          fallar();
        } else {
          const pendiente = pendientes.get(data.id);
          if (!pendiente) return;
          pendientes.delete(data.id);
          clearTimeout(pendiente.temporizador);
          pendiente.resolver([
            ...pendiente.fragmentos.flatMap((fragmento, i) =>
              entidadesDeTokens(fragmento.texto, data.resultados[i] ?? [], fragmento.inicio),
            ),
            ...detectarCargos(pendiente.texto),
          ]);
        }
      };
      vigilarCarga();
      worker.postMessage({ tipo: "cargar" });
    });

  return {
    estado: () => estado,

    cargar: (alProgreso) => {
      if (estado === "listo") return Promise.resolve(true);
      if (alProgreso) oyentes.add(alProgreso);
      carga ??= iniciar();
      return carga;
    },

    analizar: (texto) => {
      const activo = worker;
      if (estado !== "listo" || !activo || texto.trim() === "") return Promise.resolve([]);
      return new Promise((resolver) => {
        const fragmentos = partirEnFragmentos(texto);
        const id = siguienteId++;
        pendientes.set(id, {
          fragmentos,
          texto,
          resolver,
          temporizador: setTimeout(
            fallar,
            ANALISIS_BASE_MS + ANALISIS_POR_FRAGMENTO_MS * fragmentos.length,
          ),
        });
        activo.postMessage({ tipo: "analizar", id, fragmentos: fragmentos.map((f) => f.texto) });
      });
    },
  };
};
