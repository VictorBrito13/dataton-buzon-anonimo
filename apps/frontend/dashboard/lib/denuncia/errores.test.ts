import { describe, expect, it } from "vitest";
import { ErrorApi } from "@/lib/api";
import { MENSAJE_QUIZA_YA_LLEGO, mensajeDeError, mensajeDeErrorEnvio } from "./errores";

describe("mensajeDeErrorEnvio", () => {
  const conflicto = new ErrorApi(409, "No pudimos registrar la denuncia con esta frase.");

  it("en el primer intento, un 409 muestra el mensaje del servidor", () => {
    expect(mensajeDeErrorEnvio(conflicto, { reintento: false })).toBe(conflicto.message);
  });

  it("tras un reintento, un 409 avisa que la denuncia probablemente ya llegó y cómo comprobarlo", () => {
    const mensaje = mensajeDeErrorEnvio(conflicto, { reintento: true });
    expect(mensaje).toBe(MENSAJE_QUIZA_YA_LLEGO);
    expect(mensaje).toMatch(/probable/i);
    expect(mensaje).toMatch(/frase/i);
    expect(mensaje).toMatch(/seguimiento|comprobar|consulta/i);
    expect(mensaje).not.toMatch(/accesoId|409/);
  });

  it("los demás errores se tratan igual que siempre, con o sin reintento", () => {
    expect(mensajeDeErrorEnvio(new ErrorApi(400, "Faltan datos."), { reintento: true })).toBe(
      "Faltan datos.",
    );
    expect(mensajeDeErrorEnvio(new TypeError("Failed to fetch"), { reintento: true })).toMatch(
      /sigue aquí/,
    );
  });
});

describe("mensajeDeError", () => {
  it("usa el mensaje del servidor en errores 4xx", () => {
    expect(mensajeDeError(new ErrorApi(400, "Faltan datos."))).toBe("Faltan datos.");
  });

  it("tranquiliza en fallas de red o de servidor: lo escrito no se perdió", () => {
    expect(mensajeDeError(new TypeError("Failed to fetch"))).toMatch(/sigue aquí/);
    expect(mensajeDeError(new ErrorApi(503, "stack interno"))).toMatch(/sigue aquí/);
    expect(mensajeDeError(new ErrorApi(503, "stack interno"))).not.toContain("stack");
  });
});
