import { ERROR_ACCESO, generarFrase } from "@dataton/shared";
import { describe, expect, it, vi } from "vitest";
import { normalizarFolio, prepararCredencial } from "./credencial";

const MENSAJE = ERROR_ACCESO.error.message;
const ACCESO = "b".repeat(64);

describe("normalizarFolio", () => {
  it("tolera minúsculas, espacios y guiones faltantes", () => {
    expect(normalizarFolio(" bz-0123-4567-89ab-cdef ")).toBe("BZ-0123-4567-89AB-CDEF");
    expect(normalizarFolio("bz 0123 4567 89ab cdef")).toBe("BZ-0123-4567-89AB-CDEF");
    expect(normalizarFolio("BZ0123456789ABCDEF")).toBe("BZ-0123-4567-89AB-CDEF");
  });

  it("corrige las letras que Crockford Base32 no usa y se confunden con números", () => {
    expect(normalizarFolio("BZ-O1IL-0000-0000-0000")).toBe("BZ-0111-0000-0000-0000");
  });
});

describe("prepararCredencial", () => {
  it("un folio válido viaja tal cual y no se deriva nada", async () => {
    const derivar = vi.fn(async (_f: string) => ACCESO);
    await expect(
      prepararCredencial({ tipo: "folio", valor: "bz-0123-4567-89ab-cdef" }, derivar),
    ).resolves.toEqual({ tipo: "folio", folio: "BZ-0123-4567-89AB-CDEF" });
    expect(derivar).not.toHaveBeenCalled();
  });

  it("una frase válida se convierte en accesoId y la frase no se incluye", async () => {
    const frase = generarFrase();
    const derivar = vi.fn(async (_f: string) => ACCESO);
    const credencial = await prepararCredencial({ tipo: "frase", valor: frase }, derivar);
    expect(credencial).toEqual({ tipo: "frase", accesoId: ACCESO });
    expect(JSON.stringify(credencial)).not.toContain(frase.split(" ")[0]);
  });

  it("un dato con formato inválido da el mismo error uniforme, sin tocar la red", async () => {
    const derivar = vi.fn(async (_f: string) => ACCESO);
    await expect(prepararCredencial({ tipo: "folio", valor: "123" }, derivar)).rejects.toThrow(
      MENSAJE,
    );
    await expect(
      prepararCredencial({ tipo: "frase", valor: "no es una frase" }, derivar),
    ).rejects.toThrow(MENSAJE);
    expect(derivar).not.toHaveBeenCalled();
  });
});
