import { describe, expect, it } from "vitest";
import {
  construirLineaTiempo,
  describirMensajes,
  formatearDia,
  procesoDespuesDeDenunciar,
} from "./linea-tiempo";

describe("procesoDespuesDeDenunciar", () => {
  it("presenta la ruta completa en orden, con sus plazos, desde el catálogo de etapas", () => {
    const { ruta } = procesoDespuesDeDenunciar();
    expect(ruta.map((e) => e.etapa)).toEqual([
      "recibida",
      "turnada_investigadora",
      "analisis_competencia",
      "en_investigacion",
      "substanciacion",
      "tribunal",
      "resuelta",
    ]);
    expect(ruta[0]?.plazoEsperado).toBe("Hasta 5 días hábiles");
  });

  it("dice con honestidad que puede terminar antes", () => {
    const { cierresAnticipados } = procesoDespuesDeDenunciar();
    expect(cierresAnticipados.map((e) => e.etapa)).toEqual(["sin_competencia", "archivada"]);
  });
});

describe("formatearDia", () => {
  it("muestra solo el día, sin depender de la zona horaria", () => {
    expect(formatearDia("2026-03-01")).toBe("1 de marzo de 2026");
    expect(formatearDia("2026-12-31")).toBe("31 de diciembre de 2026");
  });
});

describe("construirLineaTiempo", () => {
  const consulta = {
    etapaActual: "turnada_investigadora" as const,
    lineaTiempo: [
      { etapa: "turnada_investigadora" as const, dia: "2026-11-03" },
      { etapa: "recibida" as const, dia: "2026-11-01" },
    ],
    mensajes: [],
  };

  it("ordena por fecha y marca la etapa actual, con su explicación y plazo", () => {
    const { pasadas, siguientes } = construirLineaTiempo(consulta);
    expect(pasadas.map((p) => p.etapa)).toEqual(["recibida", "turnada_investigadora"]);
    expect(pasadas[0]?.actual).toBe(false);
    expect(pasadas[1]).toMatchObject({
      actual: true,
      etiqueta: "Turnada a investigación",
      diaLegible: "3 de noviembre de 2026",
      plazoEsperado: "Hasta 10 días hábiles",
    });
    expect(siguientes.map((s) => s.etapa)).toEqual(["analisis_competencia"]);
  });

  it("en una etapa terminal no hay siguientes y se indica que concluyó", () => {
    const r = construirLineaTiempo({
      etapaActual: "archivada",
      lineaTiempo: [{ etapa: "archivada", dia: "2026-11-03" }],
    });
    expect(r.siguientes).toEqual([]);
    expect(r.concluida).toBe(true);
  });
});

describe("describirMensajes", () => {
  it("el mensaje sellado propio se explica, sin intentar mostrarlo", () => {
    const [autoridad, propio] = describirMensajes([
      { autor: "autoridad", dia: "2026-11-02", cuerpo: "Necesitamos más datos" },
      { autor: "denunciante", dia: "2026-11-03", cuerpo: null },
    ]);
    expect(autoridad).toMatchObject({
      autorLegible: "La autoridad",
      texto: "Necesitamos más datos",
    });
    expect(propio?.autorLegible).toBe("Tú");
    expect(propio?.texto).toMatch(/sellado/);
  });
});
