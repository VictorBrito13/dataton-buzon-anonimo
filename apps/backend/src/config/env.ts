import "dotenv/config";
import type { webcrypto } from "node:crypto";

type Fuente = Record<string, string | undefined>;
type JsonWebKey = webcrypto.JsonWebKey;

/** Solo para desarrollo y pruebas. En producción, usarlos es un error de arranque. */
export const VALORES_DESARROLLO = {
  pimientaAcceso: "0".repeat(64),
  altchaClaveHmac: "1".repeat(64),
  claveMensajes: "2".repeat(64),
  clavePublicaAutoridad: {
    kty: "EC",
    crv: "P-256",
    x: "4Ce4VQgpxVOK83QXNpWp9aDvR8xbbbLaT7xqguAykvM",
    y: "lLgpqedTMB40bkFVOShb5LCUNRBnt3lk7f0akK1MdzA",
  } as JsonWebKey,
} as const;

const S5_BASE_POR_DEFECTO = "https://dev-denuncias.plataformadigitalnacional.org";

const parsePort = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: "${value}"`);
  }
  return port;
};

const parseList = (value: string | undefined, fallback: string[]): string[] => {
  if (!value) return fallback;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
};

const entero = (fuente: Fuente, nombre: string, porDefecto: number): number => {
  const valor = fuente[nombre];
  if (!valor) return porDefecto;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new Error(`${nombre} debe ser un entero positivo`);
  }
  return numero;
};

/**
 * Los valores de desarrollo solo existen con `NODE_ENV` exactamente `development` o `test`.
 * En cualquier otro caso, incluido ausente, cada secreto es obligatorio y arrancar sin él falla.
 */
export const cargarEnv = (fuente: Fuente) => {
  const nodeEnv = fuente.NODE_ENV ?? "";
  const esDesarrollo = nodeEnv === "development" || nodeEnv === "test";
  const fueraDeDesarrollo = `fuera de desarrollo (NODE_ENV="${nodeEnv}")`;

  const secretoHex = (nombre: string, desarrollo: string): string => {
    const valor = fuente[nombre];
    if (!valor) {
      if (!esDesarrollo) throw new Error(`${nombre} es obligatoria ${fueraDeDesarrollo}`);
      return desarrollo;
    }
    if (!/^[0-9a-f]{64}$/.test(valor)) {
      throw new Error(`${nombre} debe tener 64 caracteres hexadecimales`);
    }
    if (!esDesarrollo && valor === desarrollo) {
      throw new Error(`${nombre} no puede usar el valor de desarrollo ${fueraDeDesarrollo}`);
    }
    return valor;
  };

  const clavePublica = (): JsonWebKey => {
    const valor = fuente.CLAVE_PUBLICA_AUTORIDAD;
    if (!valor) {
      if (!esDesarrollo) {
        throw new Error(`CLAVE_PUBLICA_AUTORIDAD es obligatoria ${fueraDeDesarrollo}`);
      }
      return VALORES_DESARROLLO.clavePublicaAutoridad;
    }
    let jwk: JsonWebKey;
    try {
      jwk = JSON.parse(valor) as JsonWebKey;
    } catch {
      throw new Error("CLAVE_PUBLICA_AUTORIDAD debe ser un JWK en JSON");
    }
    if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.x || !jwk.y || jwk.d) {
      throw new Error("CLAVE_PUBLICA_AUTORIDAD debe ser la parte pública de un JWK EC P-256");
    }
    if (!esDesarrollo && jwk.x === VALORES_DESARROLLO.clavePublicaAutoridad.x) {
      throw new Error(
        `CLAVE_PUBLICA_AUTORIDAD no puede usar la clave de desarrollo ${fueraDeDesarrollo}`,
      );
    }
    return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
  };

  const databaseUrl =
    fuente.DATABASE_URL ??
    (esDesarrollo ? "postgres://dataton:dataton@localhost:5432/dataton" : undefined);
  if (!databaseUrl) throw new Error(`DATABASE_URL es obligatoria ${fueraDeDesarrollo}`);

  const adaptador = fuente.S5_ADAPTADOR ?? "mock";
  if (adaptador !== "mock" && adaptador !== "real") {
    throw new Error('S5_ADAPTADOR debe ser "mock" o "real"');
  }

  return {
    nodeEnv,
    esDesarrollo,
    port: parsePort(fuente.PORT, 4000),
    corsOrigins: parseList(fuente.CORS_ORIGIN, ["http://localhost:3000"]),
    databaseUrl,
    pimientaAcceso: secretoHex("PIMIENTA_ACCESO", VALORES_DESARROLLO.pimientaAcceso),
    altchaClaveHmac: secretoHex("ALTCHA_CLAVE_HMAC", VALORES_DESARROLLO.altchaClaveHmac),
    claveMensajes: secretoHex("CLAVE_MENSAJES", VALORES_DESARROLLO.claveMensajes),
    clavePublicaAutoridad: clavePublica(),
    powCosto: entero(fuente, "POW_COSTO", 1000),
    powContadorMax: entero(fuente, "POW_CONTADOR_MAX", 2000),
    powExpiraSeg: entero(fuente, "POW_EXPIRA_SEG", 120),
    maxBytesEvidencia: entero(fuente, "MAX_BYTES_EVIDENCIA", 20 * 1024 * 1024),
    maxBytesEvidenciasTotal: entero(fuente, "MAX_BYTES_EVIDENCIAS_TOTAL", 100 * 1024 * 1024),
    cuotaHuerfanas: {
      bytes: entero(fuente, "CUOTA_HUERFANAS_BYTES", 2 * 1024 * 1024 * 1024),
      filas: entero(fuente, "CUOTA_HUERFANAS_FILAS", 2000),
    },
    limpiezasSimultaneas: entero(fuente, "LIMPIEZAS_SIMULTANEAS", 2),
    limpiezasEsperaMs: entero(fuente, "LIMPIEZAS_ESPERA_MS", 10_000),
    sesionLimiteGlobal: entero(fuente, "SESION_LIMITE_GLOBAL", 60),
    accesoTiempoMinimoMs: entero(fuente, "ACCESO_TIEMPO_MINIMO_MS", 400),
    accesoIntentosCredencial: entero(fuente, "ACCESO_INTENTOS_CREDENCIAL", 30),
    accesoVentanaMs: entero(fuente, "ACCESO_VENTANA_MS", 15 * 60_000),
    accesoLimiteGlobal: entero(fuente, "ACCESO_LIMITE_GLOBAL", 600),
    sesionDuracionMs: entero(fuente, "SESION_DURACION_MS", 8 * 60 * 60_000),
    s5: {
      adaptador,
      baseUrl: fuente.S5_BASE_URL ?? S5_BASE_POR_DEFECTO,
      envioAutorizado: fuente.S5_ENVIO_AUTORIZADO === "true",
    },
  } as const;
};

export const env = cargarEnv(process.env);
/** Todo lo que no sea desarrollo o pruebas se trata como producción (cookies seguras, sin stack). */
export const isProduction = !env.esDesarrollo;
