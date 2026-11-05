import { z } from "zod";
import { CLAVES_ESTADO, CLAVES_ETAPA, CLAVES_TIPO_FALTA } from "./catalogos.js";

/**
 * Zod prueba `new Function("")` al construir el primer esquema de objeto, y la CSP estricta
 * lo reporta como violación aunque Zod atrape el error. Debe ejecutarse antes que cualquier esquema.
 */
z.config({ jitless: true });

/** Contrato de la API v1. Backend y frontend importan estos esquemas; no los dupliquen. */

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const base64url = z.string().regex(/^[A-Za-z0-9_-]+$/);
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Formato BZ-XXXX-XXXX-XXXX-XXXX en Crockford Base32: 80 bits, no adivinable. */
export const esquemaFolio = z.string().regex(/^BZ(-[0-9A-HJKMNP-TV-Z]{4}){4}$/);
export const esquemaEstado = z.enum(CLAVES_ESTADO);
export const esquemaEtapa = z.enum(CLAVES_ETAPA);
export const esquemaTipoFalta = z.enum(CLAVES_TIPO_FALTA);
export const esquemaMunicipio = z.string().regex(/^\d{5}$/);

/** Solución serializada de Altcha, requerida en toda operación de escritura o consulta. */
export const esquemaPow = z.string().min(1).max(4096);

/** Límite del relato ya sellado. Las evidencias viajan aparte. */
const MAX_SELLO_B64 = 200_000;

/** GET /api/v1/configuracion */
export const respuestaConfiguracion = z.object({
  clavePublicaAutoridad: z.custom<JsonWebKey>((v) => typeof v === "object" && v !== null),
  maxBytesEvidencia: z.number().int().positive(),
  maxEvidencias: z.number().int().positive(),
  tiposEvidencia: z.array(z.string()),
});

/**
 * POST /api/v1/evidencias?pow=... con el archivo como cuerpo binario y su Content-Type.
 * El servidor verifica tipo real y metadatos, sella el archivo y descarta el original.
 */
export const respuestaEvidencia = z.object({
  evidenciaId: z.uuid(),
  metadatosEliminadosEnServidor: z.array(z.string()),
});

/** POST /api/v1/denuncias */
export const solicitudDenuncia = z.object({
  pow: esquemaPow,
  accesoId: hex64,
  estado: esquemaEstado,
  municipio: esquemaMunicipio.optional(),
  tipoFalta: esquemaTipoFalta,
  enteId: z.string().max(64).optional(),
  relatoSellado: base64url.max(MAX_SELLO_B64),
  evidenciaIds: z.array(z.uuid()).max(5),
});
export const respuestaDenuncia = z.object({ folio: esquemaFolio });

/** La credencial siempre va en el cuerpo, nunca en la URL, para no quedar en historiales ni bitácoras. */
export const esquemaCredencial = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("folio"), folio: esquemaFolio }),
  z.object({ tipo: z.literal("frase"), accesoId: hex64 }),
]);

/** POST /api/v1/acceso/consulta. Cualquier fallo devuelve el mismo 401 ERROR_ACCESO. */
export const solicitudConsulta = z.object({ pow: esquemaPow, credencial: esquemaCredencial });
export const respuestaConsulta = z.object({
  etapaActual: esquemaEtapa,
  lineaTiempo: z.array(z.object({ etapa: esquemaEtapa, dia })),
  mensajes: z.array(
    z.object({
      autor: z.enum(["autoridad", "denunciante"]),
      dia,
      /** Texto claro si lo escribió la autoridad; null si es del denunciante, sellado para ella. */
      cuerpo: z.string().nullable(),
    }),
  ),
});

/** POST /api/v1/acceso/mensajes */
export const solicitudMensajeDenunciante = z.object({
  pow: esquemaPow,
  credencial: esquemaCredencial,
  cuerpoSellado: base64url.max(MAX_SELLO_B64),
});

/** Único cuerpo de error del acceso: idéntico exista o no la credencial. */
export const ERROR_ACCESO = {
  error: { message: "No pudimos abrir esta denuncia. Revisa tus datos e inténtalo de nuevo." },
} as const;

/** Panel de autoridad; sesión con cookie HttpOnly, solo para personal autenticado. */
export const solicitudSesionAutoridad = z.object({
  usuario: z.string().min(1).max(100),
  contrasena: z.string().min(1).max(200),
});
export const resumenDenunciaAutoridad = z.object({
  id: z.uuid(),
  estado: esquemaEstado,
  municipio: esquemaMunicipio.nullable(),
  tipoFalta: esquemaTipoFalta,
  enteId: z.string().nullable(),
  etapa: esquemaEtapa,
  recibidaDia: dia,
});
export const detalleDenunciaAutoridad = resumenDenunciaAutoridad.extend({
  relatoSellado: base64url,
  lineaTiempo: z.array(z.object({ etapa: esquemaEtapa, dia })),
  evidencias: z.array(z.object({ id: z.uuid(), tipo: z.string() })),
  mensajes: z.array(
    z.object({
      autor: z.enum(["autoridad", "denunciante"]),
      dia,
      cuerpo: z.string().nullable(),
      cuerpoSellado: base64url.nullable(),
    }),
  ),
});
export const solicitudCambioEtapa = z.object({ etapa: esquemaEtapa });
export const solicitudMensajeAutoridad = z.object({ cuerpo: z.string().min(1).max(5000) });

/** GET /api/v1/publico/agregados?dimensiones=estado,tipoFalta&periodo=2026-T3 */
export const DIMENSIONES = ["estado", "municipio", "tipoFalta", "etapa", "ente"] as const;
export const esquemaDimension = z.enum(DIMENSIONES);
export const esquemaPeriodo = z.string().regex(/^\d{4}-T[1-4]$/);

export const celdaAgregada = z.object({
  /** Claves de catálogo por dimensión, por ejemplo { estado: "17", tipoFalta: "cohecho" }. */
  claves: z.record(z.string(), z.string()),
  /** null significa suprimida: el valor real nunca sale del servidor. */
  conteo: z.number().int().nonnegative().nullable(),
  motivo: z.enum(["publicada", "menor_a_k", "supresion_complementaria"]),
});
export const respuestaAgregados = z.object({
  k: z.number().int().positive(),
  periodo: esquemaPeriodo,
  dimensiones: z.array(esquemaDimension).min(1).max(2),
  celdas: z.array(celdaAgregada),
  /** Total del recorte, null si permitiría deducir alguna celda por resta. */
  total: z.number().int().nonnegative().nullable(),
});

export type SolicitudDenuncia = z.infer<typeof solicitudDenuncia>;
export type RespuestaDenuncia = z.infer<typeof respuestaDenuncia>;
export type Credencial = z.infer<typeof esquemaCredencial>;
export type SolicitudConsulta = z.infer<typeof solicitudConsulta>;
export type RespuestaConsulta = z.infer<typeof respuestaConsulta>;
export type RespuestaConfiguracion = z.infer<typeof respuestaConfiguracion>;
export type RespuestaEvidencia = z.infer<typeof respuestaEvidencia>;
export type ResumenDenunciaAutoridad = z.infer<typeof resumenDenunciaAutoridad>;
export type DetalleDenunciaAutoridad = z.infer<typeof detalleDenunciaAutoridad>;
export type Dimension = z.infer<typeof esquemaDimension>;
export type CeldaAgregada = z.infer<typeof celdaAgregada>;
export type RespuestaAgregados = z.infer<typeof respuestaAgregados>;
