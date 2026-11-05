// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  FILTROS_VACIOS,
  OPCIONES_ESTADO,
  cambiarFiltro,
  cambiarPagina,
  consultaDeFiltros,
  describirPagina,
  filtrosAConsulta,
  leerFiltros,
  totalPaginas,
} from "./filtros";

describe("leerFiltros", () => {
  it("lee valores de catálogo y la página", () => {
    const filtros = leerFiltros(
      new URLSearchParams("etapa=recibida&estado=09&tipo=peculado&pagina=3"),
    );
    expect(filtros).toEqual({ etapa: "recibida", estado: "09", tipoFalta: "peculado", pagina: 3 });
  });

  it("descarta lo que no está en el catálogo y las páginas inválidas", () => {
    expect(
      leerFiltros(new URLSearchParams("etapa=hackeada&estado=99&tipo=<script>&pagina=0")),
    ).toEqual(FILTROS_VACIOS);
    expect(leerFiltros(new URLSearchParams("pagina=abc")).pagina).toBe(1);
    expect(leerFiltros(new URLSearchParams("pagina=2.5")).pagina).toBe(1);
    expect(leerFiltros(new URLSearchParams("pagina=-4")).pagina).toBe(1);
    expect(leerFiltros(new URLSearchParams("pagina=999999999")).pagina).toBe(1);
  });
});

describe("filtrosAConsulta", () => {
  it("omite los vacíos y la primera página, y vuelve a leerse igual", () => {
    const filtros = { ...FILTROS_VACIOS, estado: "09" as const, pagina: 2 };
    const consulta = filtrosAConsulta(filtros);
    expect(consulta).toBe("estado=09&pagina=2");
    expect(leerFiltros(new URLSearchParams(consulta))).toEqual(filtros);
    expect(filtrosAConsulta(FILTROS_VACIOS)).toBe("");
    expect(filtrosAConsulta({ ...FILTROS_VACIOS, pagina: 1 })).toBe("");
  });
});

describe("consultaDeFiltros", () => {
  it("traduce los filtros a los parámetros del contrato de la API", () => {
    expect(
      consultaDeFiltros({ etapa: "recibida", estado: null, tipoFalta: "peculado", pagina: 4 }),
    ).toEqual({ pagina: 4, etapa: "recibida", tipoFalta: "peculado" });
    expect(consultaDeFiltros(FILTROS_VACIOS)).toEqual({ pagina: 1 });
  });
});

describe("cambiarFiltro", () => {
  const base = { etapa: "recibida", estado: "09", tipoFalta: null, pagina: 3 } as const;

  it("cambia un filtro sin tocar los demás y vuelve a la primera página", () => {
    expect(cambiarFiltro(base, "tipoFalta", "peculado")).toEqual({
      ...base,
      tipoFalta: "peculado",
      pagina: 1,
    });
  });

  it("un valor vacío o ajeno al catálogo deja el filtro sin aplicar", () => {
    expect(cambiarFiltro(base, "etapa", "")).toEqual({ ...base, etapa: null, pagina: 1 });
    expect(cambiarFiltro(base, "estado", "99")).toEqual({ ...base, estado: null, pagina: 1 });
  });
});

describe("cambiarPagina", () => {
  it("conserva los filtros y no baja de la primera página", () => {
    const base = { ...FILTROS_VACIOS, etapa: "recibida" as const, pagina: 2 };
    expect(cambiarPagina(base, 5)).toEqual({ ...base, pagina: 5 });
    expect(cambiarPagina(base, 0)).toEqual({ ...base, pagina: 1 });
  });
});

describe("totalPaginas", () => {
  it("al menos una, aunque no haya denuncias", () => {
    expect(totalPaginas(0, 50)).toBe(1);
    expect(totalPaginas(50, 50)).toBe(1);
    expect(totalPaginas(51, 50)).toBe(2);
    expect(totalPaginas(1234, 50)).toBe(25);
  });
});

describe("describirPagina", () => {
  it("con una sola página solo da el conteo", () => {
    expect(describirPagina({ enPagina: 2, pagina: 1, porPagina: 50, total: 2 })).toBe(
      "2 de 2 denuncias",
    );
  });

  it("sin resultados lo dice sin repetir el texto de la tabla", () => {
    expect(describirPagina({ enPagina: 0, pagina: 1, porPagina: 50, total: 0 })).toBe(
      "Sin denuncias para estos filtros",
    );
  });

  it("con varias páginas dice el tramo visible, el total y la página", () => {
    expect(describirPagina({ enPagina: 50, pagina: 1, porPagina: 50, total: 1234 })).toBe(
      "Denuncias 1 a 50 de 1,234. Página 1 de 25.",
    );
    expect(describirPagina({ enPagina: 34, pagina: 25, porPagina: 50, total: 1234 })).toBe(
      "Denuncias 1,201 a 1,234 de 1,234. Página 25 de 25.",
    );
  });

  it("una página más allá del final no inventa un tramo", () => {
    expect(describirPagina({ enPagina: 0, pagina: 30, porPagina: 50, total: 1234 })).toBe(
      "Esta página ya no existe. Hay 25 páginas.",
    );
  });
});

describe("OPCIONES_ESTADO", () => {
  it("ofrece los 32 estados en orden alfabético, con acentos en su lugar", () => {
    const nombres = OPCIONES_ESTADO.map((o) => o.texto);
    expect(nombres).toHaveLength(32);
    expect(nombres.slice(0, 5)).toEqual([
      "Aguascalientes",
      "Baja California",
      "Baja California Sur",
      "Campeche",
      "Chiapas",
    ]);
    expect(nombres.indexOf("Michoacán de Ocampo")).toBeLessThan(nombres.indexOf("Morelos"));
    expect(nombres.indexOf("Querétaro")).toBeLessThan(nombres.indexOf("Quintana Roo"));
    expect(nombres.at(-1)).toBe("Zacatecas");
    expect(nombres).toEqual([...nombres].sort((x, y) => x.localeCompare(y, "es")));
  });

  it("cada opción conserva la clave de su estado", () => {
    expect(OPCIONES_ESTADO.find((o) => o.texto === "Morelos")?.valor).toBe("17");
  });
});
