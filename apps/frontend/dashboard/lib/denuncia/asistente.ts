import type { Hallazgo } from "@/lib/privacidad";
import type { Borrador } from "./borrador";
import {
  BUSQUEDA_INICIAL,
  reducirBusqueda,
  requiereNuevaRevision,
  type EstadoBusqueda,
  type EventoBusqueda,
} from "./busqueda-modelo";
import { claveIgnorado, quitarIgnorados, reemplazarHallazgo } from "./depuracion";
import type { EvidenciaSubida } from "./evidencias";
import { confirmacionCorrecta, type Posiciones } from "./frase";
import { numeroPaso, pasoAnterior, pasoSiguiente, type ClavePaso } from "./pasos";
import {
  MAX_PERSONAS,
  validarHechos,
  validarPersonas,
  type ErroresCampo,
  type Hechos,
  type Persona,
} from "./validaciones";

export interface EstadoAsistente {
  paso: ClavePaso;
  hechos: Hechos;
  personas: Persona[];
  evidencias: EvidenciaSubida[];
  /** null: aún sin revisar. Solo existen en memoria. */
  hallazgos: Hallazgo[] | null;
  ignorados: string[];
  /** Vive aquí para sobrevivir a ir y volver entre pasos; nunca se guarda en el borrador. */
  busquedaModelo: EstadoBusqueda;
  frase: string | null;
  posiciones: Posiciones | null;
  fraseConfirmada: boolean;
  guardarBorrador: boolean;
  folio: string | null;
  errores: ErroresCampo;
}

export type AccionAsistente =
  | { tipo: "campoHecho"; campo: keyof Hechos; valor: string }
  | { tipo: "agregarPersona" }
  | { tipo: "editarPersona"; indice: number; campo: keyof Persona; valor: string }
  | { tipo: "quitarPersona"; indice: number }
  | { tipo: "evidenciaAgregada"; evidencia: EvidenciaSubida }
  | { tipo: "evidenciaQuitada"; evidenciaId: string }
  | { tipo: "avanzar" }
  | { tipo: "retroceder" }
  | { tipo: "volverA"; paso: ClavePaso }
  | { tipo: "hallazgosDetectados"; hallazgos: Hallazgo[] }
  | { tipo: "aplicarSugerencia"; hallazgo: Hallazgo }
  | { tipo: "ignorarHallazgo"; hallazgo: Hallazgo }
  | { tipo: "busquedaModelo"; evento: EventoBusqueda }
  | { tipo: "fraseGenerada"; frase: string; posiciones: Posiciones }
  | { tipo: "confirmarFrase"; respuestas: string[] }
  | { tipo: "cambiarGuardado"; activo: boolean }
  | { tipo: "restaurarBorrador"; borrador: Borrador }
  | { tipo: "denunciaEnviada"; folio: string };

const HECHOS_VACIOS: Hechos = {
  estado: "",
  municipio: "",
  tipoFalta: "",
  enteId: "",
  cuando: "",
  relato: "",
};

export const estadoInicial = (): EstadoAsistente => ({
  paso: "hechos",
  hechos: HECHOS_VACIOS,
  personas: [],
  evidencias: [],
  hallazgos: null,
  ignorados: [],
  busquedaModelo: BUSQUEDA_INICIAL,
  frase: null,
  posiciones: null,
  fraseConfirmada: false,
  guardarBorrador: false,
  folio: null,
  errores: {},
});

const sinClave = (errores: ErroresCampo, clave: string): ErroresCampo => {
  const copia = { ...errores };
  delete copia[clave];
  return copia;
};

const erroresDelPaso = (estado: EstadoAsistente): ErroresCampo => {
  if (estado.paso === "hechos") return validarHechos(estado.hechos);
  if (estado.paso === "personas") return validarPersonas(estado.personas);
  if (estado.paso === "frase" && !estado.fraseConfirmada) {
    return {
      confirmacion:
        estado.errores.confirmacion ??
        "Escribe las dos palabras que te pedimos para poder continuar.",
    };
  }
  return {};
};

export const reducirAsistente = (
  estado: EstadoAsistente,
  accion: AccionAsistente,
): EstadoAsistente => {
  switch (accion.tipo) {
    case "campoHecho": {
      const hechos = { ...estado.hechos, [accion.campo]: accion.valor };
      if (accion.campo === "estado") hechos.municipio = "";
      return {
        ...estado,
        hechos,
        errores: sinClave(estado.errores, accion.campo),
        hallazgos: accion.campo === "relato" ? null : estado.hallazgos,
      };
    }
    case "agregarPersona":
      return estado.personas.length >= MAX_PERSONAS
        ? estado
        : { ...estado, personas: [...estado.personas, { nombre: "", cargo: "" }] };
    case "editarPersona":
      return {
        ...estado,
        personas: estado.personas.map((p, i) =>
          i === accion.indice ? { ...p, [accion.campo]: accion.valor } : p,
        ),
        errores: sinClave(estado.errores, `persona-${accion.indice}-${accion.campo}`),
      };
    case "quitarPersona":
      return {
        ...estado,
        personas: estado.personas.filter((_, i) => i !== accion.indice),
        errores: {},
      };
    case "evidenciaAgregada":
      return { ...estado, evidencias: [...estado.evidencias, accion.evidencia] };
    case "evidenciaQuitada":
      return {
        ...estado,
        evidencias: estado.evidencias.filter((e) => e.evidenciaId !== accion.evidenciaId),
      };
    case "avanzar": {
      const errores = erroresDelPaso(estado);
      if (Object.keys(errores).length > 0) return { ...estado, errores };
      return { ...estado, paso: pasoSiguiente(estado.paso) ?? estado.paso, errores: {} };
    }
    case "retroceder":
      return { ...estado, paso: pasoAnterior(estado.paso) ?? estado.paso, errores: {} };
    case "volverA":
      return numeroPaso(accion.paso) < numeroPaso(estado.paso)
        ? { ...estado, paso: accion.paso, errores: {} }
        : estado;
    case "hallazgosDetectados":
      return { ...estado, hallazgos: quitarIgnorados(accion.hallazgos, estado.ignorados) };
    case "aplicarSugerencia": {
      const resultado = reemplazarHallazgo(
        estado.hechos.relato,
        estado.hallazgos ?? [],
        accion.hallazgo,
      );
      return {
        ...estado,
        hechos: { ...estado.hechos, relato: resultado.texto },
        hallazgos: resultado.hallazgos,
      };
    }
    case "ignorarHallazgo": {
      const ignorados = [...estado.ignorados, claveIgnorado(accion.hallazgo)];
      return {
        ...estado,
        ignorados,
        hallazgos: quitarIgnorados(estado.hallazgos ?? [], ignorados),
      };
    }
    case "busquedaModelo": {
      const busquedaModelo = reducirBusqueda(estado.busquedaModelo, accion.evento);
      return {
        ...estado,
        busquedaModelo,
        hallazgos: requiereNuevaRevision(estado.busquedaModelo, busquedaModelo)
          ? null
          : estado.hallazgos,
      };
    }
    case "fraseGenerada":
      return estado.frase === null
        ? { ...estado, frase: accion.frase, posiciones: accion.posiciones }
        : estado;
    case "confirmarFrase": {
      const correcta =
        estado.frase !== null &&
        estado.posiciones !== null &&
        confirmacionCorrecta(estado.frase, estado.posiciones, accion.respuestas);
      return {
        ...estado,
        fraseConfirmada: correcta,
        errores: correcta
          ? sinClave(estado.errores, "confirmacion")
          : {
              confirmacion:
                "Esas palabras no coinciden con tu frase. Revísala en donde la guardaste e inténtalo otra vez.",
            },
      };
    }
    case "cambiarGuardado":
      return { ...estado, guardarBorrador: accion.activo };
    case "restaurarBorrador":
      return {
        ...estado,
        hechos: accion.borrador.hechos,
        personas: accion.borrador.personas,
        guardarBorrador: true,
      };
    case "denunciaEnviada":
      // La frase y el relato no permanecen en memoria una vez enviados.
      return { ...estadoInicial(), paso: "envio", folio: accion.folio };
  }
};
