import { describe, expect, it } from "vitest";
import {
  ETAPAS_ENVIO,
  mensajeEsperaConsulta,
  mensajeEsperaEnvio,
  progresoEnvio,
} from "./espera-envio";

describe("progresoEnvio", () => {
  it("numera cada etapa sobre el total, en el orden en que ocurren", () => {
    expect(ETAPAS_ENVIO).toEqual(["sellando", "derivando", "verificando", "enviando"]);
    expect(progresoEnvio("sellando")).toEqual({ actual: 1, total: 4 });
    expect(progresoEnvio("enviando")).toEqual({ actual: 4, total: 4 });
  });
});

describe("mensajeEsperaEnvio", () => {
  it("dice qué está pasando en cada etapa", () => {
    expect(mensajeEsperaEnvio("sellando", 0)).toMatch(/Sellando tu relato/);
    expect(mensajeEsperaEnvio("derivando", 0)).toMatch(/Preparando tu acceso/);
    expect(mensajeEsperaEnvio("verificando", 0)).toMatch(/verificación automática/);
    expect(mensajeEsperaEnvio("enviando", 0)).toMatch(/Enviando tu denuncia/);
  });

  it("no cambia cada segundo: un lector de pantalla repetiría el aviso sin parar", () => {
    const distintos = new Set(
      Array.from({ length: 120 }, (_, s) => mensajeEsperaEnvio("verificando", s)),
    );
    expect(distintos.size).toBeLessThanOrEqual(3);
  });

  it("tras una espera larga tranquiliza y pide no cerrar la página", () => {
    const largo = mensajeEsperaEnvio("derivando", 20);
    expect(largo).toMatch(/Preparando tu acceso/);
    expect(largo).toMatch(/no cierres/i);
    expect(mensajeEsperaEnvio("derivando", 5)).not.toMatch(/no cierres/i);
  });

  it("si la espera se alarga mucho, explica que el dispositivo o la señal son lentos", () => {
    expect(mensajeEsperaEnvio("verificando", 60)).toMatch(/señal|dispositivo/i);
  });
});

describe("mensajeEsperaConsulta", () => {
  it("avisa que tarda y luego pide no cerrar la página", () => {
    expect(mensajeEsperaConsulta(0)).toMatch(/Comprobando/);
    expect(mensajeEsperaConsulta(20)).toMatch(/no cierres/i);
  });
});
