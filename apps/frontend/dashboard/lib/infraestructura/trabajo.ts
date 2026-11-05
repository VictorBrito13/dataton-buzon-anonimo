import type { Challenge } from "altcha-lib";
import { llamarApi } from "@/lib/api";
import type { PuertoTrabajo } from "@/lib/denuncia/puertos";
import type { PeticionTrabajo, RespuestaTrabajo } from "./trabajo.worker";

/** Reto de la prueba de trabajo que expone el backend (protocolo v2 de Altcha, HU-23). */
const RUTA_RETO = "/pow/reto";

type Pendiente = { resolver: (valor: string) => void; rechazar: (error: Error) => void };

let trabajador: Worker | null = null;
let siguienteId = 0;
const pendientes = new Map<number, Pendiente>();

const rechazarTodos = () => {
  for (const { rechazar } of pendientes.values()) rechazar(new Error("El trabajo falló"));
  pendientes.clear();
  trabajador?.terminate();
  trabajador = null;
};

const obtenerTrabajador = (): Worker => {
  if (trabajador) return trabajador;
  const nuevo = new Worker(new URL("./trabajo.worker.ts", import.meta.url));
  nuevo.onmessage = ({ data }: MessageEvent<RespuestaTrabajo>) => {
    const pendiente = pendientes.get(data.id);
    if (!pendiente) return;
    pendientes.delete(data.id);
    if ("error" in data) pendiente.rechazar(new Error("El trabajo falló"));
    else pendiente.resolver(data.resultado);
  };
  nuevo.onerror = rechazarTodos;
  trabajador = nuevo;
  return nuevo;
};

type PeticionSinId = PeticionTrabajo extends infer P
  ? P extends unknown
    ? Omit<P, "id">
    : never
  : never;

const encargar = (peticion: PeticionSinId): Promise<string> =>
  new Promise((resolver, rechazar) => {
    siguienteId += 1;
    pendientes.set(siguienteId, { resolver, rechazar });
    obtenerTrabajador().postMessage({ ...peticion, id: siguienteId });
  });

/**
 * Arranca el Worker antes de necesitarlo. Bajar su código tarda más que Argon2id con mala señal,
 * y esa espera no debe caer después de que la persona pulsa enviar.
 */
export const prepararTrabajador = (): void => {
  obtenerTrabajador();
};

export const trabajoEnWorker: PuertoTrabajo = {
  derivarAccesoId: (frase) => encargar({ tipo: "derivar", frase }),
  resolverPow: async () => {
    const desafio = await llamarApi<Challenge>(RUTA_RETO, {
      signal: AbortSignal.timeout(45_000),
    });
    return encargar({ tipo: "pow", desafio });
  },
};
