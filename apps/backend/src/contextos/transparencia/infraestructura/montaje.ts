import pg from "pg";
import { env, isProduction } from "../../../config/env.js";
import { K_INICIAL, REZAGO_DIAS_INICIAL } from "../dominio/metodologia.js";
import { crearFuentePdnInstantaneas, leerMunicipios } from "./fuente-pdn-instantaneas.js";
import { crearLecturaAgregados } from "./repositorios-postgres.js";
import { crearRutasPublicas } from "./rutas-publicas.js";

const entero = (valor: string | undefined, predeterminado: number): number => {
  const n = valor === undefined ? predeterminado : Number(valor);
  if (!Number.isInteger(n)) throw new Error(`Valor entero no válido: ${valor}`);
  return n;
};

export const configuracionTransparencia = {
  k: entero(process.env.TRANSPARENCIA_K, K_INICIAL),
  rezagoDias: entero(process.env.TRANSPARENCIA_REZAGO_DIAS, REZAGO_DIAS_INICIAL),
};

/**
 * La API pública usa su propia conexión con el rol de la migración 200, que solo puede leer
 * `agregados_publicos`. Un error en estas rutas no puede tocar `denuncias`.
 */
const urlLectorPublico = (): string => {
  if (process.env.DATABASE_URL_PUBLICO) return process.env.DATABASE_URL_PUBLICO;
  if (isProduction) throw new Error("DATABASE_URL_PUBLICO is required in production");
  const url = new URL(env.databaseUrl);
  url.username = "buzon_lector_publico";
  url.password = "lector_publico_solo_desarrollo";
  return url.toString();
};

const poolPublico = new pg.Pool({
  connectionString: urlLectorPublico(),
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});
poolPublico.on("error", (error) => {
  console.error("[backend] unexpected public postgres pool error", error);
});

const municipios = leerMunicipios();

export const publicoRouter = crearRutasPublicas({
  lectura: crearLecturaAgregados(poolPublico),
  pdn: crearFuentePdnInstantaneas(),
  ...configuracionTransparencia,
  municipios: (estado) =>
    municipios.filter((m) => m.estado === estado).map(({ clave, nombre }) => ({ clave, nombre })),
});
