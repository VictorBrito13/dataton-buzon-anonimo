import { describe, expect, it } from "vitest";
import { detectarContexto } from "./contexto";

const fechas = (texto: string) => detectarContexto(texto).filter((h) => h.tipo === "fecha_exacta");

describe("fechas exactas", () => {
  it.each([
    "el 14 de marzo de 2026",
    "el 14 de marzo del 2026",
    "14 de marzo de 2026",
    "el 1 de enero",
    "el martes 14 de marzo de 2026",
    "el 14 de Marzo",
    "marzo 14, 2026",
    "14/03/2026",
    "14-03-2026",
    "14.03.2026",
    "14/03/26",
    "2026-03-14",
  ])("detecta %s", (fecha) => {
    const [hallazgo] = fechas(`Ocurrió ${fecha}, por la tarde.`);
    expect(hallazgo?.texto).toBe(fecha);
    expect(hallazgo?.nivel).toBe("contexto");
  });
  it("sugiere una fecha menos precisa conservando la gramática", () => {
    expect(fechas("el 14 de marzo de 2026")[0].sugerencia).toBe("en marzo de 2026");
    expect(fechas("14/03/2026")[0].sugerencia).toBe("marzo de 2026");
    expect(fechas("el 2 de mayo")[0].sugerencia).toBe("en mayo");
  });
  it("explica en lenguaje claro el riesgo", () => {
    expect(fechas("14/03/2026")[0].explicacion).toMatch(/fecha/i);
  });
  it.each([
    "en marzo de 2026",
    "en 2026",
    "31/02/2026",
    "32 de marzo de 2026",
    "13/13/2026",
    "14 de marzos",
    "1234/03/2026",
    "versión 1.2.2026.4",
    "20 de los 30",
  ])("no marca %s", (texto) => {
    expect(fechas(texto)).toEqual([]);
  });
});

describe("expresiones de unicidad", () => {
  it.each([
    "el único que",
    "la única que",
    "los únicos que",
    "soy el único",
    "solo yo",
    "sólo yo",
    "únicamente yo",
    "nadie más",
    "mi jefe directo",
    "mi jefa directa",
    "mi supervisora",
    "yo personalmente",
    "fui quien",
    "fui yo quien",
    "fui la que",
    "yo misma",
  ])("detecta %s", (frase) => {
    const hallazgos = detectarContexto(`Resulta que ${frase} revisaba esos documentos.`);
    expect(hallazgos.map((h) => h.texto.toLowerCase())).toContain(frase);
    expect(hallazgos[0]).toMatchObject({ nivel: "contexto", tipo: "descripcion_unica" });
    expect(hallazgos[0].explicacion.length).toBeGreaterThan(20);
  });
  it("no distingue mayúsculas ni falsos parecidos", () => {
    expect(detectarContexto("EL ÚNICO QUE firmó")).toHaveLength(1);
    expect(detectarContexto("Lo único que pido es justicia")).toEqual([]);
    expect(detectarContexto("no solo yogur")).toEqual([]);
    expect(detectarContexto("mi jefe es corrupto")).toEqual([]);
  });
});

describe("primera persona que revela el rol", () => {
  it.each([
    "trabajo como contadora",
    "me desempeño como auxiliar",
    "soy el contador",
    "soy la secretaria",
    "soy contadora",
    "soy auxiliar",
    "mi puesto es",
    "mi cargo de",
    "estoy a cargo de",
    "tengo a mi cargo",
    "soy responsable de",
    "soy encargada de",
    "me encargo de",
    "laboro en",
    "trabajo en",
    "en mi área",
  ])("detecta %s", (frase) => {
    const hallazgos = detectarContexto(`Desde hace años ${frase} la oficina.`);
    expect(hallazgos.map((h) => h.texto.toLowerCase())).toContain(frase);
    expect(hallazgos[0]).toMatchObject({ nivel: "contexto", tipo: "cargo" });
    expect(hallazgos[0].explicacion).toMatch(/puesto|cargo|rol|área/i);
  });
  it.each([
    "soy una persona honesta",
    "soy testigo de lo ocurrido",
    "soy ciudadana",
    "soy muy feliz",
    "el contador firmó",
    "trabajo duro todos los días",
  ])("no marca %s", (frase) => {
    expect(detectarContexto(frase)).toEqual([]);
  });
});

describe("resultados", () => {
  it("salen ordenados, sin solapes y con posiciones exactas", () => {
    const texto = "Fui quien revisó el 14 de marzo de 2026 y soy la contadora, la única que firma.";
    const hallazgos = detectarContexto(texto);
    expect(hallazgos.length).toBeGreaterThanOrEqual(4);
    for (const [i, h] of hallazgos.entries()) {
      expect(texto.slice(h.inicio, h.fin)).toBe(h.texto);
      if (i > 0) expect(h.inicio).toBeGreaterThanOrEqual(hallazgos[i - 1].fin);
    }
  });
});
