import { describe, expect, it } from "vitest";
import { ErrorApi } from "@/lib/api";
import { mensajeDeError } from "./errores";

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
