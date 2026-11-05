import { describe, expect, it } from "vitest";
import { calcularIndicadoresEnte, type HechosEnte } from "./indicadores.js";
import type { CeldaVista } from "./k-anonimato.js";

const k = 5;

const pub = (conteo: number): CeldaVista => ({ conteo, motivo: "publicada" });
const oculta: CeldaVista = { conteo: null, motivo: "menor_a_k" };
const complementaria: CeldaVista = { conteo: null, motivo: "supresion_complementaria" };

/** 100 denuncias: 30 siguen en recepción (70 la dejaron), 20 archivadas, 30 sin competencia. */
const hechos = (parcial: Partial<HechosEnte> = {}): HechosEnte => ({
  ente: "ente-a",
  total: pub(100),
  porEtapa: {
    recibida: pub(30),
    en_investigacion: pub(20),
    archivada: pub(20),
    sin_competencia: pub(30),
  },
  conRespuesta: 70,
  tiempos: {
    recibida: { denuncias: 70, diasAcumulados: 350 },
  },
  ...parcial,
});

describe("calcularIndicadoresEnte", () => {
  it("calcula porcentajes redondeados a enteros", () => {
    const r = calcularIndicadoresEnte(hechos(), { k });
    expect(r.porcentajeConRespuesta).toBe(70);
    expect(r.porcentajeTurnado).toBe(70);
    expect(r.porcentajeArchivado).toBe(20);
    expect(r.porcentajeSinCompetencia).toBe(30);
    expect(r.motivo).toBe("publicado");
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
    expect(r.motivo).toBe("menor_a_k");
  });

  it("conserva el motivo real del total: una supresión complementaria no es «menor a k»", () => {
    const r = calcularIndicadoresEnte(hechos({ total: complementaria }), { k });
    expect(r.denuncias).toBeNull();
    expect(r.motivo).toBe("supresion_complementaria");
  });

  it("con una celda ente × etapa oculta no publica porcentajes, tiempos ni señal, y lo dice", () => {
    // Las salidas de recepción son total − recibida: publicar u ocultar su promedio diría si
    // esa resta llega a k, y con ello el valor exacto de la celda oculta.
    const r = calcularIndicadoresEnte(
      hechos({
        porEtapa: { recibida: complementaria, archivada: pub(20), sin_competencia: pub(30) },
      }),
      { k },
    );
    expect(r.denuncias).toBe(100);
    expect(r.motivo).toBe("etapa_oculta");
    expect(r.tiempoPromedioDias).toEqual({});
    expect(r.porcentajeConRespuesta).toBeNull();
    expect(r.porcentajeTurnado).toBeNull();
    expect(r.porcentajeArchivado).toBeNull();
    expect(r.porcentajeSinCompetencia).toBeNull();
    expect(r.senal).toBe("datos_insuficientes");
  });

  it("también cuando la celda oculta es de una etapa que ningún indicador muestra", () => {
    const r = calcularIndicadoresEnte(
      hechos({ porEtapa: { ...hechos().porEtapa, tribunal: oculta } }),
      { k },
    );
    expect(r.motivo).toBe("etapa_oculta");
    expect(r.tiempoPromedioDias).toEqual({});
  });

  it("una etapa ausente en porEtapa cuenta como cero publicado", () => {
    const r = calcularIndicadoresEnte(hechos(), { k });
    expect(r.motivo).toBe("publicado");
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

  it("ni uno que deje despejar menos de k respondidas sin salir de recepción", () => {
    // 70 salieron de recepción y todas cuentan como respondidas; 72 % diría que exactamente
    // 2 de las 30 que siguen en recepción recibieron mensaje.
    expect(
      calcularIndicadoresEnte(hechos({ conRespuesta: 72 }), { k }).porcentajeConRespuesta,
    ).toBeNull();
    expect(
      calcularIndicadoresEnte(hechos({ conRespuesta: 75 }), { k }).porcentajeConRespuesta,
    ).toBe(75);
  });

  it("publica 0 % y 100 %: no aíslan a nadie, igual que los ceros", () => {
    expect(
      calcularIndicadoresEnte(
        hechos({ conRespuesta: 0, porEtapa: { recibida: pub(100) }, tiempos: {} }),
        { k },
      ).porcentajeConRespuesta,
    ).toBe(0);
    expect(
      calcularIndicadoresEnte(hechos({ conRespuesta: 100 }), { k }).porcentajeConRespuesta,
    ).toBe(100);
  });

  it("no publica el tiempo de una etapa con menos de k denuncias", () => {
    // 10 resueltas, pero solo 3 pasaron por el tribunal: el promedio del tribunal sería de 3 casos.
    const r = calcularIndicadoresEnte(
      hechos({
        porEtapa: { recibida: pub(90), resuelta: pub(10) },
        conRespuesta: 10,
        tiempos: {
          recibida: { denuncias: 10, diasAcumulados: 100 },
          tribunal: { denuncias: 3, diasAcumulados: 30 },
        },
      }),
      { k },
    );
    expect(r.tiempoPromedioDias.recibida).toBe(10);
    expect(r.tiempoPromedioDias.tribunal).toBeNull();
  });

  it("marca la señal para priorizar revisión con respuesta baja, nunca con datos insuficientes", () => {
    expect(
      calcularIndicadoresEnte(hechos({ conRespuesta: 40, porEtapa: { recibida: pub(60) } }), {
        k,
      }).senal,
    ).toBe("priorizar_revision");
    expect(calcularIndicadoresEnte(hechos(), { k }).senal).toBe("sin_senal");
    expect(calcularIndicadoresEnte(hechos({ total: oculta }), { k }).senal).toBe(
      "datos_insuficientes",
    );
  });
});
