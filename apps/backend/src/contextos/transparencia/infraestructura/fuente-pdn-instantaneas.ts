import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RespuestaCoberturaPdn, RespuestaPdn } from "@dataton/shared";
import type { FuenteDatosPdn } from "../aplicacion/puertos.js";
import { AVISOS_COBERTURA, contrastarConS3, type AgregadoCobertura } from "../dominio/cobertura.js";
import {
  cruzarPorNombreYJurisdiccion,
  type CompradorS6,
  type InstitucionS3,
} from "../dominio/instituciones.js";

/** Lee solo los archivos del repositorio: en tiempo de ejecución no hay llamadas a terceros. */
const DIRECTORIO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../datos/pdn",
);

const leer = <T>(archivo: string): T =>
  JSON.parse(readFileSync(path.join(DIRECTORIO, archivo), "utf8")) as T;

type Fuente = RespuestaPdn["fuentes"][number];

interface InstantaneaS3 {
  fuente: Fuente;
  umbralPorInstitucion: number;
  registrosSinInstitucion: number;
  registrosConNombreNoInterpretable: number;
  porEstado: RespuestaPdn["s3"]["porEstado"];
  instituciones: InstitucionS3[];
}

const ADVERTENCIAS = [
  "Son conteos reales de sistemas de la PDN, sin relación con las denuncias sintéticas de este tablero.",
  "Cobertura incompleta: S3 reúne 22 proveedores estatales más el IFT y no incluye un proveedor federal general.",
  "S6 llega hasta 2021. Un procedimiento de contratación no implica ninguna irregularidad.",
  "El cruce por nombre es una prueba de concepto: SESNA advierte de homónimos y de la calidad de los datos.",
  "Es una señal para priorizar revisión, nunca una acusación.",
];

const MAYORES_S6 = 10;

export const crearFuentePdnInstantaneas = (): FuenteDatosPdn => {
  const s3 = leer<InstantaneaS3>("s3-conteos.json");
  const s6 = leer<{ fuente: Fuente; compradores: CompradorS6[] }>("s6-conteos.json");
  const cobertura = leer<{ fuente: Fuente } & AgregadoCobertura>("cobertura-resumen.json");
  const coberturaPublica: RespuestaCoberturaPdn = {
    ...cobertura,
    datosSinteticos: false,
    kAnonimato: "no_aplica",
    avisos: AVISOS_COBERTURA,
    contrasteS3: contrastarConS3(cobertura.porEntidad, s3.porEstado),
  };
  const cruce = cruzarPorNombreYJurisdiccion(s3.instituciones, s6.compradores);
  const procedimientos = s6.compradores.reduce((suma, c) => suma + c.procedimientos, 0);

  return {
    cobertura: () => coberturaPublica,
    resumen: (estado) => ({
      fuentes: [s3.fuente, s6.fuente, cobertura.fuente],
      advertencias: ADVERTENCIAS,
      s3: {
        umbralPorInstitucion: s3.umbralPorInstitucion,
        registrosSinInstitucion: s3.registrosSinInstitucion,
        registrosConNombreNoInterpretable: s3.registrosConNombreNoInterpretable,
        porEstado: s3.porEstado,
        instituciones: s3.instituciones
          .filter((i) => i.estado === estado)
          .map(({ nombre, conteo }) => ({ nombre, conteo })),
      },
      s6: {
        compradores: s6.compradores.length,
        procedimientos,
        mayores: s6.compradores
          .slice(0, MAYORES_S6)
          .map(({ nombre, procedimientos: n }) => ({ nombre, procedimientos: n })),
      },
      cruce,
    }),
  };
};

export interface MunicipioCatalogo {
  clave: string;
  estado: string;
  nombre: string;
}

export const leerMunicipios = (): MunicipioCatalogo[] =>
  leer<{ municipios: { clave: string; nombre: string }[] }>("municipios.json").municipios.map(
    (m) => ({ ...m, estado: m.clave.slice(0, 2) }),
  );
