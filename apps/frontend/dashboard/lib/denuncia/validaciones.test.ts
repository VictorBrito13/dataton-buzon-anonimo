import { describe, expect, it } from "vitest";
import {
  MAX_RELATO,
  MIN_RELATO,
  personasConDatos,
  validarHechos,
  validarPersonas,
} from "./validaciones";

const hechos = {
  estado: "17",
  municipio: "",
  tipoFalta: "cohecho",
  enteId: "",
  cuando: "2026-03",
  relato: "x".repeat(MIN_RELATO),
};

describe("validarHechos", () => {
  it("pide mes y año, o que la persona diga que no lo recuerda", () => {
    expect(validarHechos({ ...hechos, cuando: "" }).cuando).toBeDefined();
    expect(validarHechos({ ...hechos, cuando: "2026-" }).cuando).toBeDefined();
    expect(validarHechos({ ...hechos, cuando: "-03" }).cuando).toBeDefined();
    expect(validarHechos({ ...hechos, cuando: "no_recuerdo" })).toEqual({});
  });

  it("acepta hechos completos con municipio y ente vacíos, porque son opcionales", () => {
    expect(validarHechos(hechos)).toEqual({});
  });

  it("exige estado, tipo de falta y relato", () => {
    const errores = validarHechos({ ...hechos, estado: "", tipoFalta: "", relato: "" });
    expect(Object.keys(errores).sort()).toEqual(["estado", "relato", "tipoFalta"]);
  });

  it("acepta 'otra' como respuesta de quien no está seguro", () => {
    expect(validarHechos({ ...hechos, tipoFalta: "otra" })).toEqual({});
  });

  it("rechaza claves fuera de catálogo", () => {
    expect(validarHechos({ ...hechos, estado: "99" }).estado).toBeDefined();
    expect(validarHechos({ ...hechos, tipoFalta: "inventada" }).tipoFalta).toBeDefined();
  });

  it("rechaza un municipio de otro estado", () => {
    expect(validarHechos({ ...hechos, municipio: "09003" }).municipio).toBeDefined();
    expect(validarHechos({ ...hechos, municipio: "17007" })).toEqual({});
  });

  it("no cuenta los espacios como relato y limita el largo", () => {
    expect(validarHechos({ ...hechos, relato: " ".repeat(MIN_RELATO + 5) }).relato).toBeDefined();
    expect(validarHechos({ ...hechos, relato: "x".repeat(MAX_RELATO + 1) }).relato).toBeDefined();
  });
});

describe("personas involucradas", () => {
  it("son opcionales y las filas vacías no cuentan", () => {
    expect(validarPersonas([])).toEqual({});
    expect(personasConDatos([{ nombre: "  ", cargo: "" }])).toEqual([]);
  });

  it("recorta y conserva las filas con algún dato", () => {
    expect(personasConDatos([{ nombre: " Ente A ", cargo: "" }])).toEqual([
      { nombre: "Ente A", cargo: "" },
    ]);
  });

  it("señala el campo demasiado largo de la fila correcta", () => {
    const errores = validarPersonas([
      { nombre: "a", cargo: "" },
      { nombre: "b".repeat(301), cargo: "" },
    ]);
    expect(Object.keys(errores)).toEqual(["persona-1-nombre"]);
  });
});
