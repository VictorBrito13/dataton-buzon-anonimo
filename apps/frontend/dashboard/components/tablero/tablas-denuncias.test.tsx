// @vitest-environment node
import type { RespuestaIndicadores } from "@dataton/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { etiquetaDenuncias, IndicadoresEntes } from "./tablas-denuncias";

const k = 5;

const ente = (
  parcial: Partial<RespuestaIndicadores["entes"][number]>,
): RespuestaIndicadores["entes"][number] => ({
  ente: "ficticio-01",
  etiqueta: "Ente ficticio 01",
  motivo: "publicado",
  denuncias: 120,
  porcentajeConRespuesta: 80,
  porcentajeTurnado: 60,
  porcentajeArchivado: 10,
  porcentajeSinCompetencia: 5,
  tiempoPromedioDias: { recibida: 4, en_investigacion: 30 },
  senal: "sin_senal",
  ...parcial,
});

const datos = (entes: RespuestaIndicadores["entes"]): RespuestaIndicadores => ({
  k,
  periodo: "2026-T3",
  datosSinteticos: true,
  aviso: "Señal, nunca acusación.",
  entes,
});

describe("etiquetaDenuncias", () => {
  it("«< k» solo cuando el total del ente es de verdad menor que k", () => {
    expect(etiquetaDenuncias({ denuncias: null, motivo: "menor_a_k" }, k)).toBe("< 5");
  });

  it("«Oculta» para una supresión complementaria: el total puede ser mucho mayor que k", () => {
    expect(etiquetaDenuncias({ denuncias: null, motivo: "supresion_complementaria" }, k)).toBe(
      "Oculta",
    );
  });

  it("muestra el total cuando está publicado, aunque falten los derivados", () => {
    expect(etiquetaDenuncias({ denuncias: 30, motivo: "etapa_oculta" }, k)).toBe("30");
  });
});

describe("IndicadoresEntes", () => {
  it("un ente con etapa oculta muestra su total y «Oculto» en los derivados, y lo explica", () => {
    const html = renderToStaticMarkup(
      <IndicadoresEntes
        datos={datos([
          ente({
            ente: "ficticio-07",
            motivo: "etapa_oculta",
            denuncias: 30,
            porcentajeConRespuesta: null,
            porcentajeTurnado: null,
            porcentajeArchivado: null,
            porcentajeSinCompetencia: null,
            tiempoPromedioDias: {},
            senal: "datos_insuficientes",
          }),
        ])}
      />,
    );
    expect(html).toContain(">30<");
    expect(html).not.toContain("&lt; 5");
    expect(html).toContain("Oculto");
    expect(html).toContain("sus porcentajes, tiempos y señal se omiten");
  });

  it("sin entes con etapa oculta no muestra esa explicación", () => {
    const html = renderToStaticMarkup(<IndicadoresEntes datos={datos([ente({})])} />);
    expect(html).not.toContain("se omiten");
    expect(html).toContain("80 %");
  });
});
