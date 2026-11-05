import {
  respuestaAgregados,
  respuestaCoberturaPdn,
  respuestaIndicadores,
  respuestaMetodologia,
  respuestaMunicipios,
  respuestaPdn,
  respuestaPeriodos,
  type Dimension,
  type RespuestaAgregados,
  type RespuestaCoberturaPdn,
  type RespuestaIndicadores,
  type RespuestaMetodologia,
  type RespuestaMunicipios,
  type RespuestaPdn,
  type RespuestaPeriodos,
} from "@dataton/shared";
import type { z } from "zod";

/** Solo en el servidor: el navegador no llama a la API para pintar el tablero. */
const API_INTERNA = process.env.API_INTERNA ?? "http://localhost:4000";

const pedir = async <T extends z.ZodType>(ruta: string, esquema: T): Promise<z.infer<T>> => {
  const respuesta = await fetch(`${API_INTERNA}/api/v1/publico${ruta}`, { cache: "no-store" });
  if (!respuesta.ok) throw new Error(`${ruta} respondió ${respuesta.status}`);
  return esquema.parse(await respuesta.json());
};

const tabla = (periodo: string, ...dimensiones: Dimension[]): Promise<RespuestaAgregados> =>
  pedir(`/agregados?dimensiones=${dimensiones.join(",")}&periodo=${periodo}`, respuestaAgregados);

export interface DatosTablero {
  periodos: RespuestaPeriodos;
  periodo: string;
  estados: RespuestaAgregados;
  tipos: RespuestaAgregados;
  etapas: RespuestaAgregados;
  tiposPorEtapa: RespuestaAgregados;
  municipios: RespuestaAgregados;
  nombresMunicipios: RespuestaMunicipios | null;
  indicadores: RespuestaIndicadores;
  metodologia: RespuestaMetodologia;
  pdn: RespuestaPdn;
  cobertura: RespuestaCoberturaPdn;
}

export const obtenerPeriodos = (): Promise<RespuestaPeriodos> =>
  pedir("/periodos", respuestaPeriodos);

export const obtenerTablero = async (
  periodos: RespuestaPeriodos,
  periodo: string,
  estado: string | null,
): Promise<DatosTablero> => {
  const [
    estados,
    tipos,
    etapas,
    tiposPorEtapa,
    municipios,
    nombresMunicipios,
    indicadores,
    metodologia,
    pdn,
    cobertura,
  ] = await Promise.all([
    tabla(periodo, "estado"),
    tabla(periodo, "tipoFalta"),
    tabla(periodo, "etapa"),
    tabla(periodo, "tipoFalta", "etapa"),
    tabla(periodo, "municipio"),
    estado ? pedir(`/catalogos/municipios?estado=${estado}`, respuestaMunicipios) : null,
    pedir(`/indicadores?periodo=${periodo}`, respuestaIndicadores),
    pedir("/metodologia", respuestaMetodologia),
    pedir(`/pdn${estado ? `?estado=${estado}` : ""}`, respuestaPdn),
    pedir("/cobertura-pdn", respuestaCoberturaPdn),
  ]);
  return {
    periodos,
    periodo,
    estados,
    tipos,
    etapas,
    tiposPorEtapa,
    municipios,
    nombresMunicipios,
    indicadores,
    metodologia,
    pdn,
    cobertura,
  };
};
