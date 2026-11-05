import { describe, expect, it, vi } from "vitest";
import { solveChallenge } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import { cargarEnv, VALORES_DESARROLLO } from "../../src/config/env.js";
import { CifradorAes } from "../../src/compartido/infraestructura/cifrador-aes.js";
import { HuellasHmac } from "../../src/compartido/infraestructura/huellas-hmac.js";
import { PowAltcha } from "../../src/compartido/infraestructura/pow-altcha.js";
import { registrarError } from "../../src/compartido/infraestructura/registro.js";

const CLAVE = "c".repeat(64);

describe("cargarEnv", () => {
  it("redondea en la zona de México si no se configura otra", () => {
    expect(cargarEnv({ NODE_ENV: "test" }).zonaHoraria).toBe("America/Mexico_City");
    expect(cargarEnv({ NODE_ENV: "test", ZONA_HORARIA: "UTC" }).zonaHoraria).toBe("UTC");
  });

  it("no arranca con una zona horaria que no existe", () => {
    expect(() => cargarEnv({ NODE_ENV: "test", ZONA_HORARIA: "Marte/Olympus" })).toThrow(
      /ZONA_HORARIA/,
    );
  });

  const produccion = {
    NODE_ENV: "production",
    DATABASE_URL: "postgres://x",
    PIMIENTA_ACCESO: "1".repeat(64),
    ALTCHA_CLAVE_HMAC: "2".repeat(64),
    CLAVE_MENSAJES: "3".repeat(64),
    CLAVE_PUBLICA_AUTORIDAD: JSON.stringify({ kty: "EC", crv: "P-256", x: "a", y: "b" }),
  };

  it.each(["development", "test"])("usa valores de desarrollo solo con NODE_ENV=%s", (nodeEnv) => {
    const env = cargarEnv({ NODE_ENV: nodeEnv });
    expect(env.pimientaAcceso).toBe(VALORES_DESARROLLO.pimientaAcceso);
    expect(env.esDesarrollo).toBe(true);
    expect(env.maxBytesEvidencia).toBe(20 * 1024 * 1024);
    expect(env.maxBytesEvidenciasTotal).toBe(100 * 1024 * 1024);
    expect(env.powExpiraSeg).toBe(120);
    expect(env.s5.adaptador).toBe("mock");
    expect(env.s5.envioAutorizado).toBe(false);
  });

  it.each([undefined, "", "Development", "staging", "prod", "production"])(
    "con NODE_ENV=%s no hay valores por defecto para los secretos: lanza",
    (nodeEnv) => {
      expect(() => cargarEnv({ NODE_ENV: nodeEnv })).toThrow(/DATABASE_URL|PIMIENTA_ACCESO/);
      const { NODE_ENV: _omitido, ...sinSecretos } = { ...produccion, NODE_ENV: nodeEnv };
      for (const nombre of ["PIMIENTA_ACCESO", "CLAVE_PUBLICA_AUTORIDAD"] as const) {
        const fuente: Record<string, string | undefined> = { ...sinSecretos, NODE_ENV: nodeEnv };
        delete fuente[nombre];
        expect(() => cargarEnv(fuente), nombre).toThrow(nombre);
      }
    },
  );

  it("fuera de desarrollo rechaza los valores de desarrollo aunque NODE_ENV falte", () => {
    const { NODE_ENV: _omitido, ...sinNodeEnv } = produccion;
    expect(() =>
      cargarEnv({ ...sinNodeEnv, PIMIENTA_ACCESO: VALORES_DESARROLLO.pimientaAcceso }),
    ).toThrow("PIMIENTA_ACCESO");
    expect(cargarEnv(sinNodeEnv).esDesarrollo).toBe(false);
  });

  it("acepta producción completa", () => {
    const env = cargarEnv(produccion);
    expect(env.pimientaAcceso).toBe("1".repeat(64));
    expect(env.esDesarrollo).toBe(false);
  });

  it.each([
    "DATABASE_URL",
    "PIMIENTA_ACCESO",
    "ALTCHA_CLAVE_HMAC",
    "CLAVE_MENSAJES",
    "CLAVE_PUBLICA_AUTORIDAD",
  ])("exige %s en producción", (nombre) => {
    const incompleto: Record<string, string | undefined> = { ...produccion };
    delete incompleto[nombre];
    expect(() => cargarEnv(incompleto)).toThrow(nombre);
  });

  it("rechaza en producción los valores de desarrollo", () => {
    expect(() =>
      cargarEnv({ ...produccion, PIMIENTA_ACCESO: VALORES_DESARROLLO.pimientaAcceso }),
    ).toThrow("PIMIENTA_ACCESO");
    expect(() =>
      cargarEnv({
        ...produccion,
        CLAVE_PUBLICA_AUTORIDAD: JSON.stringify(VALORES_DESARROLLO.clavePublicaAutoridad),
      }),
    ).toThrow("CLAVE_PUBLICA_AUTORIDAD");
  });

  it("rechaza claves mal formadas y adaptador desconocido", () => {
    const dev = { NODE_ENV: "development" };
    expect(() => cargarEnv({ ...dev, PIMIENTA_ACCESO: "corta" })).toThrow("PIMIENTA_ACCESO");
    expect(() => cargarEnv({ ...dev, CLAVE_PUBLICA_AUTORIDAD: "{no json" })).toThrow(
      "CLAVE_PUBLICA_AUTORIDAD",
    );
    expect(() => cargarEnv({ ...dev, S5_ADAPTADOR: "otro" })).toThrow("S5_ADAPTADOR");
  });
});

describe("HuellasHmac", () => {
  it("es determinista, depende de la pimienta y no contiene el valor", () => {
    const a = new HuellasHmac(CLAVE);
    const b = new HuellasHmac("d".repeat(64));
    expect(a.huella("x")).toEqual(a.huella("x"));
    expect(a.huella("x")).not.toEqual(b.huella("x"));
    expect(a.huella("x")).toHaveLength(32);
  });
});

describe("CifradorAes", () => {
  const cifrador = new CifradorAes(CLAVE);

  it("descifra lo cifrado y no deja el texto a la vista", () => {
    const bytes = cifrador.cifrar("Mensaje de la autoridad", "d1");
    expect(Buffer.from(bytes).toString("latin1")).not.toContain("Mensaje");
    expect(cifrador.descifrar(bytes, "d1")).toBe("Mensaje de la autoridad");
  });

  it("no descifra si el mensaje se mueve a otra denuncia", () => {
    expect(() => cifrador.descifrar(cifrador.cifrar("x", "d1"), "d2")).toThrow();
  });

  it("usa un iv distinto cada vez", () => {
    expect(cifrador.cifrar("x", "d1")).not.toEqual(cifrador.cifrar("x", "d1"));
  });
});

describe("PowAltcha", () => {
  const armar = (ahora = () => Date.now(), maxUsados = 100) =>
    new PowAltcha({
      claveHmac: CLAVE,
      costo: 1,
      contadorMax: 5,
      expiraSeg: 60,
      maxUsados,
      ahoraMs: ahora,
    });

  const resolver = async (pow: PowAltcha): Promise<string> => {
    const challenge = await pow.crearReto();
    const solution = await solveChallenge({ challenge, deriveKey });
    return Buffer.from(JSON.stringify({ challenge, solution })).toString("base64");
  };

  it("acepta una solución válida una sola vez", async () => {
    const pow = armar();
    const solucion = await resolver(pow);
    expect(await pow.consumir(solucion)).toBe(true);
    expect(await pow.consumir(solucion)).toBe(false);
  });

  it("rechaza basura sin lanzar", async () => {
    const pow = armar();
    expect(await pow.consumir("no es base64 ni json")).toBe(false);
    expect(await pow.consumir(Buffer.from("[]").toString("base64"))).toBe(false);
    expect(await pow.consumir(Buffer.from('{"challenge":1}').toString("base64"))).toBe(false);
  });

  it("rechaza un reto firmado con otra clave", async () => {
    const otra = new PowAltcha({
      claveHmac: "e".repeat(64),
      costo: 1,
      contadorMax: 5,
      expiraSeg: 60,
      maxUsados: 100,
    });
    expect(await armar().consumir(await resolver(otra))).toBe(false);
  });

  it("rechaza una solución que no corresponde al reto", async () => {
    const pow = armar();
    const payload = JSON.parse(Buffer.from(await resolver(pow), "base64").toString("utf8")) as {
      solution: { derivedKey: string };
    };
    payload.solution.derivedKey = "00".repeat(32);
    expect(await pow.consumir(Buffer.from(JSON.stringify(payload)).toString("base64"))).toBe(false);
  });

  it("rechaza un reto expirado", async () => {
    const pow = armar();
    const solucion = await resolver(pow);
    vi.useFakeTimers({ now: Date.now() + 61_000 });
    try {
      expect(await pow.consumir(solucion)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("falla cerrado si la memoria de usados está llena", async () => {
    const pow = armar(undefined, 1);
    expect(await pow.consumir(await resolver(pow))).toBe(true);
    expect(await pow.consumir(await resolver(pow))).toBe(false);
  });
});

describe("registrarError", () => {
  it("no escribe mensaje, cuerpo ni detalles del error", () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.assign(new Error("Key (folio)=(BZ-SECRETO) already exists"), {
      code: "23505",
      body: '{"credencial":"secreta"}',
      detail: "1.2.3.4",
    });
    registrarError("prueba", error);
    const salida = JSON.stringify(espia.mock.calls);
    espia.mockRestore();
    expect(salida).toContain("23505");
    expect(salida).not.toMatch(/SECRETO|secreta|1\.2\.3\.4/);
  });
});
