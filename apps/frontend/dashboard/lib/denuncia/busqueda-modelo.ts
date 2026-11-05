import type { Hallazgo, TipoHallazgo } from "@/lib/privacidad";
import { ARCHIVOS_MODELO_NER } from "@/lib/privacidad/dominio/archivos-modelo";

/**
 * La búsqueda opcional de nombres, cargos y lugares (capa 2 del depurador). Es
 * siempre un añadido: en cualquier fase las reglas siguen revisando el relato y la
 * denuncia se puede enviar.
 */
export type FaseBusqueda = "apagada" | "cargando" | "analizando" | "lista" | "fallo" | "cancelada";

export interface EstadoBusqueda {
  fase: FaseBusqueda;
  /** 0 a 100 mientras se descarga. */
  porcentaje: number;
}

export type EventoBusqueda =
  | { tipo: "activar" }
  | { tipo: "progreso"; porcentaje: number }
  | { tipo: "cargaTerminada"; exito: boolean }
  /** Quitar la casilla o pulsar Cancelar: en ambos casos se detiene y se libera el modelo. */
  | { tipo: "cancelar" }
  | { tipo: "revisionTerminada"; modeloListo: boolean };

export const BUSQUEDA_INICIAL: EstadoBusqueda = { fase: "apagada", porcentaje: 0 };

export const reducirBusqueda = (estado: EstadoBusqueda, evento: EventoBusqueda): EstadoBusqueda => {
  switch (evento.tipo) {
    case "activar":
      return { fase: "cargando", porcentaje: 0 };
    case "progreso": {
      if (estado.fase !== "cargando" || !Number.isFinite(evento.porcentaje)) return estado;
      const porcentaje = Math.min(100, Math.max(estado.porcentaje, evento.porcentaje));
      return { ...estado, porcentaje };
    }
    case "cargaTerminada":
      if (estado.fase !== "cargando") return estado;
      return { ...estado, fase: evento.exito ? "analizando" : "fallo" };
    case "cancelar":
      return { ...estado, fase: estado.fase === "lista" ? "apagada" : "cancelada" };
    case "revisionTerminada":
      if (estado.fase !== "analizando" && estado.fase !== "lista") return estado;
      return { ...estado, fase: evento.modeloListo ? "lista" : "fallo" };
  }
};

/** La casilla está marcada mientras la búsqueda siga en marcha o haya terminado bien. */
export const busquedaActiva = ({ fase }: EstadoBusqueda): boolean =>
  fase === "cargando" || fase === "analizando" || fase === "lista";

/** El modelo ya cargó y la revisión del relato debe contar con él. */
export const modeloActivoEnRevision = ({ fase }: EstadoBusqueda): boolean =>
  fase === "analizando" || fase === "lista";

/**
 * Revisar de nuevo solo cuando el modelo entra o sale de la revisión, porque
 * vuelve a calcular la lista de hallazgos. Lo demás conserva lo ya revisado.
 */
export const requiereNuevaRevision = (anterior: EstadoBusqueda, nuevo: EstadoBusqueda): boolean => {
  if (anterior.fase === "cargando" && nuevo.fase === "analizando") return true;
  return (
    modeloActivoEnRevision(anterior) && (nuevo.fase === "apagada" || nuevo.fase === "cancelada")
  );
};

const SIGUE_CON_REGLAS =
  "Tu texto se sigue revisando con las reglas (teléfonos, correos y otros datos), pero no los nombres: búscalos tú al leerlo.";

/** Texto de la región viva. Cambia poco a poco: cada cambio lo lee un lector de pantalla. */
export const mensajeBusqueda = (estado: EstadoBusqueda, disponible: boolean): string => {
  if (!disponible) {
    return `Esta opción no está disponible en este sitio porque el modelo no se instaló. ${SIGUE_CON_REGLAS}`;
  }
  switch (estado.fase) {
    case "apagada":
      return "";
    case "cargando":
      return estado.porcentaje >= 100
        ? "Preparando el modelo en tu dispositivo. Puede tardar un poco."
        : `Descargando el modelo: ${Math.floor(estado.porcentaje / 10) * 10}%. Mientras tanto puedes continuar.`;
    case "analizando":
      return "Buscando nombres, cargos y lugares en tu dispositivo.";
    case "lista":
      return "Búsqueda terminada en tu dispositivo. Lo que marque son sugerencias y puede no detectarlo todo: léelo una vez más.";
    case "fallo":
      return `No pudimos usar el modelo. ${SIGUE_CON_REGLAS} Puedes continuar con tu denuncia o intentarlo otra vez.`;
    case "cancelada":
      return `Cancelaste la búsqueda. ${SIGUE_CON_REGLAS}`;
  }
};

const TIPOS_DEL_MODELO: readonly TipoHallazgo[] = ["persona", "lugar", "organizacion", "cargo"];

/** Los cargos salen de una lista, no del modelo, pero llegan con la misma opción y son igual de inciertos. */
export const esSugerenciaDelModelo = ({ tipo }: Hallazgo): boolean =>
  TIPOS_DEL_MODELO.includes(tipo);

export const resumenHallazgos = (hallazgos: readonly Hallazgo[]): string => {
  const total = hallazgos.length === 1 ? "1 dato" : `${hallazgos.length} datos`;
  const sugerencias = hallazgos.filter(esSugerenciaDelModelo).length;
  const aclaracion =
    sugerencias === 0
      ? ""
      : sugerencias === 1
        ? " 1 es una sugerencia automática y puede equivocarse."
        : ` ${sugerencias} son sugerencias automáticas y pueden equivocarse.`;
  return `Encontramos ${total}.${aclaracion} Tú decides qué hacer con cada uno.`;
};

/** ¿Están publicados todos los archivos? Si no se puede saber, se responde que no. */
export const modeloPublicado = (existe: (ruta: string) => boolean): boolean => {
  try {
    return ARCHIVOS_MODELO_NER.every(existe);
  } catch {
    return false;
  }
};
