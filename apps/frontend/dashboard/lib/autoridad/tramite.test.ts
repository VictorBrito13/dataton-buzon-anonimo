// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CLAVES_ETAPA, TRANSICIONES } from "@dataton/shared";
import { admiteCambios, avisoDeConfirmacion, etapasDisponibles } from "./tramite";

describe("etapasDisponibles", () => {
  it("ofrece exactamente las etapas de TRANSICIONES para cada etapa", () => {
    for (const etapa of CLAVES_ETAPA) {
      expect(etapasDisponibles(etapa).map((o) => o.etapa)).toEqual([...TRANSICIONES[etapa]]);
    }
  });

  it("incluye la etiqueta del catálogo y si la etapa destino concluye el trámite", () => {
    expect(etapasDisponibles("analisis_competencia")).toEqual([
      { etapa: "en_investigacion", etiqueta: "En investigación", concluye: false },
      { etapa: "sin_competencia", etiqueta: "Enviada a otra autoridad", concluye: true },
    ]);
  });

  it("no ofrece nada en una etapa terminal", () => {
    expect(etapasDisponibles("resuelta")).toEqual([]);
    expect(admiteCambios("resuelta")).toBe(false);
    expect(admiteCambios("recibida")).toBe(true);
  });
});

describe("avisoDeConfirmacion", () => {
  it("nombra origen y destino, y advierte que se registra y no se deshace", () => {
    const aviso = avisoDeConfirmacion("recibida", "turnada_investigadora");
    expect(aviso).toContain("Recibida");
    expect(aviso).toContain("Turnada a investigación");
    expect(aviso).toMatch(/bitácora/);
    expect(aviso).toMatch(/no se puede deshacer/);
  });

  it("advierte cuando el destino concluye el trámite", () => {
    expect(avisoDeConfirmacion("en_investigacion", "archivada")).toMatch(/concluye el trámite/);
    expect(avisoDeConfirmacion("recibida", "turnada_investigadora")).not.toMatch(
      /concluye el trámite/,
    );
  });

  it("rechaza una transición que TRANSICIONES no permite", () => {
    expect(() => avisoDeConfirmacion("recibida", "resuelta")).toThrow();
  });
});
