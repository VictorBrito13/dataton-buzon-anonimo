// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { abrir, generarParDeClaves, sellar } from "@dataton/shared";
import { ErrorClave, crearBovedaDeClave, interpretarClavePrivada } from "./clave";

const motivoDe = async (promesa: Promise<unknown>): Promise<string> => {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof ErrorClave) return error.motivo;
    throw error;
  }
  throw new Error("Se esperaba un ErrorClave");
};

describe("interpretarClavePrivada", () => {
  it("acepta una privada P-256 y conserva solo los campos necesarios", async () => {
    const { privada } = await generarParDeClaves();
    const clave = await interpretarClavePrivada(JSON.stringify({ ...privada, kid: "demo" }));
    expect(Object.keys(clave).sort()).toEqual(["crv", "d", "kty", "x", "y"]);
  });

  it("tolera el BOM y los saltos de línea que deja PowerShell al redirigir a un archivo", async () => {
    const { privada } = await generarParDeClaves();
    const clave = await interpretarClavePrivada(`﻿${JSON.stringify(privada)}\r\n`);
    expect(clave.d).toBe(privada.d);
  });

  it("la clave resultante abre sellos aunque el archivo declare otros usos", async () => {
    const { privada, publica } = await generarParDeClaves();
    const sello = await sellar(publica, new TextEncoder().encode("hola"));
    const clave = await interpretarClavePrivada(
      JSON.stringify({ ...privada, key_ops: ["deriveKey"], ext: false }),
    );
    expect(new TextDecoder().decode(await abrir(clave, sello))).toBe("hola");
  });

  it("distingue los motivos de rechazo", async () => {
    const { privada, publica } = await generarParDeClaves();
    expect(await motivoDe(interpretarClavePrivada("no es json"))).toBe("formato");
    expect(await motivoDe(interpretarClavePrivada('{"kty":"RSA"}'))).toBe("formato");
    expect(await motivoDe(interpretarClavePrivada(JSON.stringify(publica)))).toBe("es_publica");
    expect(await motivoDe(interpretarClavePrivada(JSON.stringify({ ...privada, d: "AAAA" })))).toBe(
      "invalida",
    );
  });

  it("no repite material de la clave en el mensaje de error", async () => {
    const { privada } = await generarParDeClaves();
    const texto = JSON.stringify({ ...privada, d: `${privada.d}x` });
    const error = await interpretarClavePrivada(texto).catch((e: Error) => e);
    expect((error as Error).message).not.toContain(privada.d);
  });
});

describe("crearBovedaDeClave", () => {
  const archivoDe = (contenido: string) => new File([contenido], "clave.jwk");

  it("empieza vacía, carga, avisa y olvida", async () => {
    const { privada } = await generarParDeClaves();
    const boveda = crearBovedaDeClave();
    const aviso = vi.fn();
    boveda.suscribir(aviso);

    expect(boveda.clave()).toBeNull();
    await boveda.cargar(archivoDe(JSON.stringify(privada)));
    expect(boveda.clave()?.d).toBe(privada.d);
    expect(aviso).toHaveBeenCalledTimes(1);

    boveda.olvidar();
    expect(boveda.clave()).toBeNull();
    expect(aviso).toHaveBeenCalledTimes(2);
  });

  it("un archivo inválido no reemplaza la clave ya cargada", async () => {
    const { privada } = await generarParDeClaves();
    const boveda = crearBovedaDeClave();
    await boveda.cargar(archivoDe(JSON.stringify(privada)));
    expect(await motivoDe(boveda.cargar(archivoDe("{}")))).toBe("formato");
    expect(boveda.clave()?.d).toBe(privada.d);
  });

  it("rechaza archivos demasiado grandes sin leerlos", async () => {
    const boveda = crearBovedaDeClave();
    const grande = archivoDe("x".repeat(20_000));
    const leer = vi.spyOn(grande, "text");
    expect(await motivoDe(boveda.cargar(grande))).toBe("demasiado_grande");
    expect(leer).not.toHaveBeenCalled();
  });

  it("deja de avisar a quien se desuscribe", async () => {
    const boveda = crearBovedaDeClave();
    const aviso = vi.fn();
    const desuscribir = boveda.suscribir(aviso);
    desuscribir();
    boveda.olvidar();
    expect(aviso).not.toHaveBeenCalled();
  });
});
