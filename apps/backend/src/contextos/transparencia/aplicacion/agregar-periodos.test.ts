import type { Etapa } from "@dataton/shared";
import { describe, expect, it } from "vitest";
import { acotarConIndicadores } from "../dominio/ataque-indicadores.js";
import { acotarPorIntervalos } from "../dominio/ataque-intervalos.js";
import type { IndicadoresEnte } from "../dominio/indicadores.js";
import { anchoMinimo } from "../dominio/k-anonimato.js";
import { construirRed, idDeClaves } from "../dominio/publicacion.js";
import { agregarPeriodos, resumirPeriodo, TABLA_INDICADORES } from "./agregar-periodos.js";
import type {
  DenunciaFuente,
  FilaAgregado,
  FuenteDenuncias,
  RepositorioPublicacion,
} from "./puertos.js";

const denuncia = (parcial: Partial<DenunciaFuente> = {}): DenunciaFuente => ({
  estado: "17",
  municipio: "17007",
  tipoFalta: "cohecho",
  enteId: "ente-a",
  recibidaDia: "2026-08-10",
  etapas: [{ etapa: "recibida", dia: "2026-08-10" }],
  respuestaDia: null,
  ...parcial,
});

const universo = {
  municipios: [{ clave: "17007", estado: "17" }],
  entes: ["ente-a"],
};

class FuenteFalsa implements FuenteDenuncias {
  constructor(private readonly denuncias: DenunciaFuente[]) {}
  denunciasRecibidasEntre(inicio: string, fin: string): Promise<DenunciaFuente[]> {
    return Promise.resolve(
      this.denuncias.filter((d) => d.recibidaDia >= inicio && d.recibidaDia <= fin),
    );
  }
}

class RepositorioFalso implements RepositorioPublicacion {
  readonly guardados = new Map<string, FilaAgregado[]>();
  periodosPublicados(): Promise<string[]> {
    return Promise.resolve([...this.guardados.keys()]);
  }
  guardarPeriodo(periodo: string, filas: FilaAgregado[]): Promise<void> {
    if (this.guardados.has(periodo)) throw new Error("ya publicado");
    this.guardados.set(periodo, filas);
    return Promise.resolve();
  }
}

const opciones = { k: 5, rezagoDias: 14, hoy: "2026-11-04", desde: "2026-T1", universo };

const muchas = (n: number, parcial: Partial<DenunciaFuente> = {}): DenunciaFuente[] =>
  Array.from({ length: n }, () => denuncia(parcial));

describe("resumirPeriodo", () => {
  it("toma la etapa vigente en la fecha de corte, no la actual", () => {
    const { denuncias } = resumirPeriodo(
      [
        denuncia({
          etapas: [
            { etapa: "recibida", dia: "2026-08-10" },
            { etapa: "turnada_investigadora", dia: "2026-08-20" },
            { etapa: "analisis_competencia", dia: "2026-11-01" },
          ],
        }),
      ],
      "2026-T3",
      14,
    );
    expect(denuncias[0]?.etapa).toBe("turnada_investigadora");
  });

  it("acumula por ente los días de las etapas concluidas antes del corte", () => {
    const { hechos } = resumirPeriodo(
      [
        denuncia({
          etapas: [
            { etapa: "recibida", dia: "2026-08-10" },
            { etapa: "turnada_investigadora", dia: "2026-08-20" },
          ],
        }),
      ],
      "2026-T3",
      14,
    );
    expect(hechos.get("ente-a")?.tiempos.recibida).toEqual({ denuncias: 1, diasAcumulados: 10 });
  });

  it("cuenta respuesta si hubo mensaje de la autoridad o avance antes del corte", () => {
    const { hechos } = resumirPeriodo(
      [
        denuncia({ respuestaDia: "2026-09-01" }),
        denuncia({ respuestaDia: "2026-12-01" }),
        denuncia({
          etapas: [
            { etapa: "recibida", dia: "2026-08-10" },
            { etapa: "turnada_investigadora", dia: "2026-08-20" },
          ],
        }),
      ],
      "2026-T3",
      14,
    );
    expect(hechos.get("ente-a")?.conRespuesta).toBe(2);
  });
});

describe("agregarPeriodos", () => {
  it("publica solo trimestres cerrados y con rezago cumplido", async () => {
    const repositorio = new RepositorioFalso();
    const fuente = new FuenteFalsa([
      ...muchas(50, { recibidaDia: "2026-08-10" }),
      ...muchas(50, { recibidaDia: "2026-10-20" }),
    ]);
    const publicados = await agregarPeriodos(fuente, repositorio, opciones);
    expect(publicados).toEqual(["2026-T3"]);
  });

  it("no publica un trimestre sin denuncias", async () => {
    const repositorio = new RepositorioFalso();
    expect(await agregarPeriodos(new FuenteFalsa([]), repositorio, opciones)).toEqual([]);
  });

  it("guarda k y los indicadores por ente junto a las tablas", async () => {
    const repositorio = new RepositorioFalso();
    await agregarPeriodos(new FuenteFalsa(muchas(50)), repositorio, opciones);
    const filas = repositorio.guardados.get("2026-T3") ?? [];
    expect(filas.every((f) => f.k === 5)).toBe(true);
    const indicador = filas.find((f) => f.dimensiones === "indicador_ente");
    expect(indicador?.claves).toEqual({ ente: "ente-a" });
    expect(indicador?.detalle).toMatchObject({ denuncias: 50 });
  });

  it("los indicadores no filtran valores reales de las celdas ocultas", async () => {
    const repositorio = new RepositorioFalso();
    await agregarPeriodos(new FuenteFalsa(muchas(3)), repositorio, opciones);
    const filas = repositorio.guardados.get("2026-T3") ?? [];
    const indicador = filas.find((f) => f.dimensiones === "indicador_ente");
    expect(indicador?.detalle).toMatchObject({ denuncias: null, porcentajeConRespuesta: null });
    expect(JSON.stringify(indicador?.detalle)).not.toContain('"denuncias":3');
  });
});

describe("HU-31 · Ataque por indicadores: lo que publican todos los canales de un trimestre", () => {
  const CAMINO: Etapa[] = [
    "recibida",
    "turnada_investigadora",
    "analisis_competencia",
    "en_investigacion",
  ];
  const dia = (n: number): string => `2026-08-${String(n).padStart(2, "0")}`;
  /** Una denuncia del ente que, antes del corte, llegó hasta `etapa` pasando por el camino. */
  const hasta = (enteId: string, etapa: Etapa): DenunciaFuente => {
    const camino =
      etapa === "sin_competencia"
        ? [...CAMINO.slice(0, 3), etapa]
        : CAMINO.slice(0, CAMINO.indexOf(etapa) + 1);
    return denuncia({
      enteId,
      recibidaDia: dia(1),
      etapas: camino.map((e, i) => ({ etapa: e, dia: dia(1 + i * 5) })),
    });
  };

  const grandes = ["ente-a", "ente-b", "ente-c", "ente-d", "ente-e", "ente-f"];
  const etapasGrandes: Etapa[] = ["recibida", "turnada_investigadora", "en_investigacion"];
  const fuente = new FuenteFalsa([
    ...grandes.flatMap((enteId, i) =>
      etapasGrandes.flatMap((etapa) =>
        Array.from({ length: 40 + i * 10 }, () => hasta(enteId, etapa)),
      ),
    ),
    // El ente atacado: 30 denuncias, 26 siguen en recepción y 1 en cada una de otras cuatro etapas.
    ...Array.from({ length: 26 }, () => hasta("ente-z", "recibida")),
    hasta("ente-z", "turnada_investigadora"),
    hasta("ente-z", "analisis_competencia"),
    hasta("ente-z", "en_investigacion"),
    hasta("ente-z", "sin_competencia"),
  ]);
  const universoAmplio = { ...universo, entes: [...grandes, "ente-z"] };

  const publicar = async () => {
    const repositorio = new RepositorioFalso();
    await agregarPeriodos(fuente, repositorio, { ...opciones, universo: universoAmplio });
    const filas = repositorio.guardados.get("2026-T3") ?? [];
    // Lo mismo que sirven /agregados y las descargas: celdas con conteo y motivo.
    const vista = new Map(
      filas
        .filter((f) => f.dimensiones !== TABLA_INDICADORES)
        .map((f) => [idDeClaves(f.claves), { conteo: f.conteo, motivo: f.motivo }]),
    );
    // Lo mismo que sirve /indicadores.
    const indicadores = filas
      .filter((f) => f.dimensiones === TABLA_INDICADORES)
      .map((f) => f.detalle as IndicadoresEnte);
    const denuncias = await fuente.denunciasRecibidasEntre("2026-07-01", "2026-09-30");
    const red = construirRed(resumirPeriodo(denuncias, "2026-T3", 14).denuncias, universoAmplio);
    return { filas, vista, indicadores, red };
  };

  const recibida = idDeClaves({ ente: "ente-z", etapa: "recibida" });

  it("el escenario es el descrito: recepción oculta por complemento y cuatro celdas «< k»", async () => {
    const { vista, red } = await publicar();
    expect(vista.get(recibida)).toEqual({ conteo: null, motivo: "supresion_complementaria" });
    expect(vista.get(idDeClaves({ ente: "ente-z" }))?.conteo).toBe(30);
    for (const etapa of ["turnada_investigadora", "analisis_competencia", "en_investigacion"]) {
      expect(vista.get(idDeClaves({ ente: "ente-z", etapa }))?.motivo).toBe("menor_a_k");
    }
    // Con las tablas solas, el mejor atacante deja un rango amplio.
    const soloTablas = acotarPorIntervalos(vista, red.lineas, 5);
    expect(soloTablas.get(recibida)).toEqual({ min: 14, max: 26 });
  });

  it("sumar /indicadores a las tablas no acota ninguna celda oculta del ente", async () => {
    const { vista, indicadores, red } = await publicar();
    const cotas = acotarConIndicadores(vista, red.lineas, indicadores, 5);
    for (const [id, celda] of vista) {
      if (celda.conteo !== null) continue;
      const cota = cotas.get(id);
      if (!cota) throw new Error(`Sin cota: ${id}`);
      expect(cota.max - cota.min, `${id}: ${cota.min}..${cota.max}`).toBeGreaterThanOrEqual(
        anchoMinimo(5),
      );
    }
  });

  it("el indicador del ente dice por qué no trae porcentajes ni tiempos", async () => {
    const { indicadores } = await publicar();
    const z = indicadores.find((i) => i.ente === "ente-z");
    expect(z).toMatchObject({ denuncias: 30, motivo: "etapa_oculta", tiempoPromedioDias: {} });
    expect(z?.porcentajeConRespuesta).toBeNull();
  });
});

describe("HU-31 · Ataque de resta entre periodos", () => {
  const conteoDe = (filas: FilaAgregado[], dimensiones: string): (number | null)[] =>
    filas.filter((f) => f.dimensiones === dimensiones).map((f) => f.conteo);

  it("un trimestre ya publicado no se recalcula: dos descargas siempre son idénticas", async () => {
    const repositorio = new RepositorioFalso();
    await agregarPeriodos(new FuenteFalsa(muchas(50)), repositorio, opciones);
    const primera = JSON.stringify(repositorio.guardados.get("2026-T3"));
    // Llega un caso más, fechado en el mismo trimestre: restar publicaciones lo aislaría.
    await agregarPeriodos(new FuenteFalsa(muchas(51)), repositorio, opciones);
    expect(JSON.stringify(repositorio.guardados.get("2026-T3"))).toBe(primera);
  });

  it("los trimestres no se acumulan: cada denuncia cuenta en un solo periodo", async () => {
    const repositorio = new RepositorioFalso();
    await agregarPeriodos(
      new FuenteFalsa([
        ...muchas(30, {
          recibidaDia: "2026-05-10",
          etapas: [{ etapa: "recibida", dia: "2026-05-10" }],
        }),
        ...muchas(40, { recibidaDia: "2026-08-10" }),
      ]),
      repositorio,
      opciones,
    );
    expect(conteoDe(repositorio.guardados.get("2026-T2") ?? [], "total")).toEqual([30]);
    expect(conteoDe(repositorio.guardados.get("2026-T3") ?? [], "total")).toEqual([40]);
  });

  it("un avance de etapa posterior al corte no altera el trimestre, aunque se calcule después", async () => {
    const base = muchas(30, { recibidaDia: "2026-08-10" });
    const avanzadas = base.map((d) => ({
      ...d,
      etapas: [...d.etapas, { etapa: "turnada_investigadora" as const, dia: "2026-11-01" }],
    }));
    const a = new RepositorioFalso();
    const b = new RepositorioFalso();
    await agregarPeriodos(new FuenteFalsa(base), a, opciones);
    await agregarPeriodos(new FuenteFalsa(avanzadas), b, opciones);
    expect(JSON.stringify(b.guardados.get("2026-T3"))).toBe(
      JSON.stringify(a.guardados.get("2026-T3")),
    );
  });
});
