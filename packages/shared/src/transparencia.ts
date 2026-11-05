import { z } from "zod";
import { esquemaPeriodo } from "./api.js";

/** Contrato de los datos abiertos: lo que `api.ts` no cubre de /api/v1/publico. */

/** GET /api/v1/publico/periodos */
export const respuestaPeriodos = z.object({
  periodos: z.array(z.object({ periodo: esquemaPeriodo, k: z.number().int().positive() })),
  rezagoDias: z.number().int().nonnegative(),
  /** En este prototipo todas las denuncias del tablero son sintéticas. */
  datosSinteticos: z.boolean(),
});

/** GET /api/v1/publico/catalogos/municipios?estado=17 */
export const respuestaMunicipios = z.object({
  municipios: z.array(z.object({ clave: z.string(), nombre: z.string() })),
  fuente: z.string(),
});

const esquemaSenal = z.enum(["priorizar_revision", "sin_senal", "datos_insuficientes"]);

/** GET /api/v1/publico/indicadores?periodo=2026-T3 */
export const respuestaIndicadores = z.object({
  k: z.number().int().positive(),
  periodo: esquemaPeriodo,
  datosSinteticos: z.boolean(),
  aviso: z.string(),
  entes: z.array(
    z.object({
      ente: z.string(),
      etiqueta: z.string(),
      denuncias: z.number().int().nonnegative().nullable(),
      porcentajeConRespuesta: z.number().nullable(),
      porcentajeTurnado: z.number().nullable(),
      porcentajeArchivado: z.number().nullable(),
      porcentajeSinCompetencia: z.number().nullable(),
      tiempoPromedioDias: z.record(z.string(), z.number().nullable()),
      senal: esquemaSenal,
    }),
  ),
});

const esquemaFuentePdn = z.object({
  nombre: z.string(),
  url: z.string(),
  consultadoEl: z.string(),
  licencia: z.string(),
  cobertura: z.string().optional(),
});

/** GET /api/v1/publico/pdn?estado=17. Conteos reales por institución, nunca registros. */
export const respuestaPdn = z.object({
  fuentes: z.array(esquemaFuentePdn),
  advertencias: z.array(z.string()),
  s3: z.object({
    umbralPorInstitucion: z.number().int().positive(),
    registrosSinInstitucion: z.number().int().nonnegative(),
    registrosConNombreNoInterpretable: z.number().int().nonnegative(),
    porEstado: z.array(
      z.object({
        estado: z.string(),
        registros: z.number().int().nonnegative(),
        instituciones: z.number().int().nonnegative(),
      }),
    ),
    /** Del estado pedido. `conteo` null significa por debajo del umbral. */
    instituciones: z.array(
      z.object({ nombre: z.string(), conteo: z.number().int().positive().nullable() }),
    ),
  }),
  s6: z.object({
    compradores: z.number().int().nonnegative(),
    procedimientos: z.number().int().nonnegative(),
    mayores: z.array(z.object({ nombre: z.string(), procedimientos: z.number().int() })),
  }),
  cruce: z.object({
    coincidencias: z.array(
      z.object({
        nombre: z.string(),
        estado: z.string(),
        sanciones: z.number().int().nullable(),
        procedimientos: z.number().int(),
      }),
    ),
    homonimosDescartados: z.number().int().nonnegative(),
    sinJurisdiccionConocida: z.number().int().nonnegative(),
  }),
});

const filaEjemplo = z.object({
  municipio: z.string(),
  cohecho: z.number().int().nullable(),
  abuso: z.number().int().nullable(),
  total: z.number().int().nullable(),
});

/** GET /api/v1/publico/metodologia */
export const respuestaMetodologia = z.object({
  k: z.number().int().positive(),
  anchoMinimo: z.number().int().positive(),
  rezagoDias: z.number().int().nonnegative(),
  datosSinteticos: z.boolean(),
  reglas: z.array(z.string()),
  garantia: z.string(),
  noCubre: z.array(z.string()),
  /** Calculado por el motor real en cada petición, no escrito a mano. */
  ejemploAtaque: z.object({
    original: z.array(filaEjemplo),
    protegida: z.array(filaEjemplo),
    rango: z.object({ min: z.number().int(), max: z.number().int() }),
    valorReal: z.number().int(),
  }),
  tablas: z.array(z.string()),
});

/** Entes ficticios del generador sintético. No corresponden a ninguna institución real. */
export const ENTES_SINTETICOS = [
  { id: "ficticio-01", etiqueta: "Ente ficticio 01 · Obras", peso: 22, atencion: 0.92 },
  { id: "ficticio-02", etiqueta: "Ente ficticio 02 · Salud", peso: 20, atencion: 0.85 },
  { id: "ficticio-03", etiqueta: "Ente ficticio 03 · Educación", peso: 16, atencion: 0.78 },
  { id: "ficticio-04", etiqueta: "Ente ficticio 04 · Seguridad", peso: 14, atencion: 0.45 },
  { id: "ficticio-05", etiqueta: "Ente ficticio 05 · Hacienda", peso: 9, atencion: 0.7 },
  { id: "ficticio-06", etiqueta: "Ente ficticio 06 · Movilidad", peso: 7, atencion: 0.35 },
  { id: "ficticio-07", etiqueta: "Ente ficticio 07 · Agua", peso: 5, atencion: 0.6 },
  { id: "ficticio-08", etiqueta: "Ente ficticio 08 · Cultura", peso: 0.05, atencion: 0.9 },
] as const;

export type RespuestaPeriodos = z.infer<typeof respuestaPeriodos>;
export type RespuestaMunicipios = z.infer<typeof respuestaMunicipios>;
export type RespuestaIndicadores = z.infer<typeof respuestaIndicadores>;
export type RespuestaPdn = z.infer<typeof respuestaPdn>;
export type RespuestaMetodologia = z.infer<typeof respuestaMetodologia>;
