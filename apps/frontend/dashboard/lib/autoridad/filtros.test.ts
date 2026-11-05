// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ResumenDenunciaAutoridad } from "@dataton/shared";
import {
  FILTROS_VACIOS,
  OPCIONES_ESTADO,
  cambiarFiltro,
  describirListado,
  filtrarDenuncias,
  filtrosAConsulta,
  leerFiltros,
} from "./filtros";

const denuncia = (parcial: Partial<ResumenDenunciaAutoridad>): ResumenDenunciaAutoridad => ({
  id: "6f1c1c1e-3f0a-4a53-9a55-0d3f6a1b2c3d",
  estado: "17",
  municipio: null,
  tipoFalta: "cohecho",
  enteId: null,
  etapa: "recibida",
  recibidaDia: "2026-03-01",
  ...parcial,
});

const a = denuncia({ recibidaDia: "2026-01-10", etapa: "recibida", estado: "17" });
const b = denuncia({ recibidaDia: "2026-03-10", etapa: "archivada", estado: "09" });
const c = denuncia({
  recibidaDia: "2026-02-10",
  etapa: "recibida",
  estado: "09",
  tipoFalta: "peculado",
});

describe("leerFiltros", () => {
  it("lee valores de catálogo", () => {
    const filtros = leerFiltros(new URLSearchParams("etapa=recibida&estado=09&tipo=peculado"));
    expect(filtros).toEqual({ etapa: "recibida", estado: "09", tipoFalta: "peculado" });
  });

  it("descarta lo que no está en el catálogo", () => {
    const filtros = leerFiltros(new URLSearchParams("etapa=hackeada&estado=99&tipo=<script>"));
    expect(filtros).toEqual(FILTROS_VACIOS);
  });
});

describe("filtrosAConsulta", () => {
  it("omite los vacíos y vuelve a leerse igual", () => {
    const filtros = { ...FILTROS_VACIOS, estado: "09" as const };
    const consulta = filtrosAConsulta(filtros);
    expect(consulta).toBe("estado=09");
    expect(leerFiltros(new URLSearchParams(consulta))).toEqual(filtros);
    expect(filtrosAConsulta(FILTROS_VACIOS)).toBe("");
  });
});

describe("cambiarFiltro", () => {
  const base = { etapa: "recibida", estado: "09", tipoFalta: null } as const;

  it("cambia un filtro sin tocar los demás", () => {
    expect(cambiarFiltro(base, "tipoFalta", "peculado")).toEqual({
      ...base,
      tipoFalta: "peculado",
    });
  });

  it("un valor vacío o ajeno al catálogo deja el filtro sin aplicar", () => {
    expect(cambiarFiltro(base, "etapa", "")).toEqual({ ...base, etapa: null });
    expect(cambiarFiltro(base, "estado", "99")).toEqual({ ...base, estado: null });
  });
});

describe("filtrarDenuncias", () => {
  it("sin filtros devuelve todas, de la más reciente a la más antigua", () => {
    expect(filtrarDenuncias([a, b, c], FILTROS_VACIOS)).toEqual([b, c, a]);
  });

  it("combina los filtros con Y", () => {
    expect(filtrarDenuncias([a, b, c], { ...FILTROS_VACIOS, etapa: "recibida" })).toEqual([c, a]);
    expect(filtrarDenuncias([a, b, c], { ...FILTROS_VACIOS, estado: "09" })).toEqual([b, c]);
    expect(
      filtrarDenuncias([a, b, c], { etapa: "recibida", estado: "09", tipoFalta: "peculado" }),
    ).toEqual([c]);
    expect(filtrarDenuncias([a, b, c], { ...FILTROS_VACIOS, tipoFalta: "otra" })).toEqual([]);
  });

  it("no altera la lista recibida", () => {
    const lista = [a, b, c];
    filtrarDenuncias(lista, FILTROS_VACIOS);
    expect(lista).toEqual([a, b, c]);
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

describe("describirListado", () => {
  it("con la lista completa solo da el conteo", () => {
    expect(describirListado({ visibles: 2, cargadas: 2, total: 2 })).toBe("2 de 2 denuncias");
  });

  it("si el servidor recortó la lista, avisa cuántas se muestran y que los filtros no ven el resto", () => {
    expect(describirListado({ visibles: 500, cargadas: 500, total: 1234 })).toBe(
      "Se muestran las 500 denuncias más recientes de 1,234. Los filtros solo buscan entre esas 500.",
    );
  });

  it("con filtros sobre una lista recortada dice cuántas coinciden", () => {
    expect(describirListado({ visibles: 12, cargadas: 500, total: 1234 })).toBe(
      "12 coinciden entre las 500 denuncias más recientes de 1,234. Los filtros solo buscan entre esas 500.",
    );
  });
});
