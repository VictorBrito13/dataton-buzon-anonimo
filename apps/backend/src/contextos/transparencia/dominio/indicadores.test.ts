import { describe, expect, it } from "vitest";
import { calcularIndicadoresEnte, type HechosEnte } from "./indicadores.js";
import type { CeldaVista } from "./k-anonimato.js";

const k = 5;

const pub = (conteo: number): CeldaVista => ({ conteo, motivo: "publicada" });
const oculta: CeldaVista = { conteo: null, motivo: "menor_a_k" };

const hechos = (parcial: Partial<HechosEnte> = {}): HechosEnte => ({
  ente: "ente-a",
  total: pub(100),
  porEtapa: {
    recibida: pub(10),
    archivada: pub(20),
    sin_competencia: pub(30),
  },
  conRespuesta: 70,
  tiempos: {
    recibida: { denuncias: 90, diasAcumulados: 450 },
  },
  ...parcial,
});

describe("calcularIndicadoresEnte", () => {
  it("calcula porcentajes redondeados a enteros", () => {
    const r = calcularIndicadoresEnte(hechos(), { k });
    expect(r.porcentajeConRespuesta).toBe(70);
    expect(r.porcentajeTurnado).toBe(90);
    expect(r.porcentajeArchivado).toBe(20);
    expect(r.porcentajeSinCompetencia).toBe(30);
  });

  it("calcula el tiempo promedio por etapa en días", () => {
    const r = calcularIndicadoresEnte(hechos(), { k });
    expect(r.tiempoPromedioDias.recibida).toBe(5);
  });

  it("oculta todo cuando el total del ente está suprimido", () => {
    const r = calcularIndicadoresEnte(hechos({ total: oculta }), { k });
    expect(r.porcentajeConRespuesta).toBeNull();
    expect(r.porcentajeArchivado).toBeNull();
    expect(r.tiempoPromedioDias.recibida).toBeUndefined();
    expect(r.motivo).toBe("ente_menor_a_k");
  });

  it("un porcentaje no revela lo que la celda ocultó: etapa oculta, porcentaje oculto", () => {
    const r = calcularIndicadoresEnte(
      hechos({ porEtapa: { recibida: pub(10), archivada: oculta, sin_competencia: pub(30) } }),
      { k },
    );
    expect(r.porcentajeArchivado).toBeNull();
  });

  it("no publica un porcentaje turnado si su complemento (recibida) está oculto", () => {
    const r = calcularIndicadoresEnte(
      hechos({ porEtapa: { recibida: oculta, archivada: pub(20), sin_competencia: pub(30) } }),
      { k },
    );
    expect(r.porcentajeTurnado).toBeNull();
  });

  it("no publica un porcentaje de respuesta que permita despejar menos de k casos", () => {
    // 3 de 100: porcentaje × total revelaría el 3.
    expect(
      calcularIndicadoresEnte(hechos({ conRespuesta: 3 }), { k }).porcentajeConRespuesta,
    ).toBeNull();
    // 97 de 100: el complemento revelaría 3 sin respuesta.
    expect(
      calcularIndicadoresEnte(hechos({ conRespuesta: 97 }), { k }).porcentajeConRespuesta,
    ).toBeNull();
  });

  it("publica 0 % y 100 %: no aíslan a nadie, igual que los ceros", () => {
    expect(calcularIndicadoresEnte(hechos({ conRespuesta: 0 }), { k }).porcentajeConRespuesta).toBe(
      0,
    );
    expect(
      calcularIndicadoresEnte(hechos({ conRespuesta: 100 }), { k }).porcentajeConRespuesta,
    ).toBe(100);
  });

  it("no publica el tiempo de una etapa con menos de k denuncias", () => {
    const r = calcularIndicadoresEnte(
      hechos({ tiempos: { recibida: { denuncias: 4, diasAcumulados: 40 } } }),
      { k },
    );
    expect(r.tiempoPromedioDias.recibida).toBeNull();
  });

  it("marca la señal para priorizar revisión con respuesta baja, nunca con datos insuficientes", () => {
    expect(calcularIndicadoresEnte(hechos({ conRespuesta: 40 }), { k }).senal).toBe(
      "priorizar_revision",
    );
    expect(calcularIndicadoresEnte(hechos(), { k }).senal).toBe("sin_senal");
    expect(calcularIndicadoresEnte(hechos({ total: oculta }), { k }).senal).toBe(
      "datos_insuficientes",
    );
  });
});
