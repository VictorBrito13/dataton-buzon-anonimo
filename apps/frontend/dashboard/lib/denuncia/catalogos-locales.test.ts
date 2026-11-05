import { describe, expect, it } from "vitest";
import {
  buscarEntes,
  debeCargarEntes,
  indexarEntes,
  municipiosDeEstado,
  nombreEnte,
  nombreMunicipio,
  type CatalogoEntes,
  type CatalogoMunicipios,
} from "./catalogos-locales";

const municipios: CatalogoMunicipios = {
  "17": [
    ["007", "Cuernavaca"],
    ["006", "Cuautla"],
  ],
};

const entes: CatalogoEntes = [
  [1, "SECRETARÍA DE SALUD", "00"],
  [2, "SECRETARÍA DE SALUD DE MORELOS", "17"],
  [3, "AYUNTAMIENTO DE CUERNAVACA", "17"],
  [4, "SECRETARÍA DE SALUD DE JALISCO", "14"],
  [5, "INSTITUTO DE SALUD PARA EL BIENESTAR", "00"],
];

describe("municipiosDeEstado", () => {
  it("arma la clave INEGI de 5 dígitos y ordena por nombre", () => {
    expect(municipiosDeEstado(municipios, "17")).toEqual([
      { clave: "17006", nombre: "Cuautla" },
      { clave: "17007", nombre: "Cuernavaca" },
    ]);
  });

  it("un estado sin datos o vacío no rompe el selector", () => {
    expect(municipiosDeEstado(municipios, "99")).toEqual([]);
    expect(municipiosDeEstado(municipios, "")).toEqual([]);
  });
});

describe("nombreMunicipio", () => {
  it("resuelve la clave INEGI de 5 dígitos", () => {
    expect(nombreMunicipio(municipios, "17007")).toBe("Cuernavaca");
  });

  it("sin coincidencia devuelve null", () => {
    expect(nombreMunicipio(municipios, "17999")).toBeNull();
    expect(nombreMunicipio(municipios, "99007")).toBeNull();
  });
});

describe("buscarEntes", () => {
  const indice = indexarEntes(entes);
  const ids = (r: { id: number }[]) => r.map((e) => e.id);

  it("ignora acentos y mayúsculas", () => {
    expect(ids(buscarEntes(indice, "cuernávaca", "17"))).toEqual([3]);
  });

  it("exige todas las palabras, en cualquier orden", () => {
    expect(ids(buscarEntes(indice, "morelos salud", "17"))).toEqual([2]);
  });

  it("muestra el estado elegido y los federales, no los de otros estados", () => {
    expect(ids(buscarEntes(indice, "salud", "17"))).toEqual([2, 5, 1]);
  });

  it("prioriza los entes del estado elegido", () => {
    expect(ids(buscarEntes(indice, "salud", "17"))[0]).toBe(2);
  });

  it("sin estado busca en todo el catálogo", () => {
    expect(ids(buscarEntes(indice, "jalisco", ""))).toEqual([4]);
  });

  it("no busca con menos de 3 letras y respeta el límite", () => {
    expect(buscarEntes(indice, "sa", "17")).toEqual([]);
    expect(buscarEntes(indice, "secretaria", "", 2)).toHaveLength(2);
  });

  it("no repite un ente que aparece dos veces en el catálogo con el mismo nombre y estado", () => {
    const repetidos = indexarEntes([
      [7, "MUNICIPIO DE CUERNAVACA", "17"],
      [8, "MUNICIPIO DE CUERNAVACA", "17"],
    ]);
    expect(ids(buscarEntes(repetidos, "cuernavaca", "17"))).toEqual([7]);
  });

  it("encuentra el nombre a partir de la clave guardada", () => {
    expect(nombreEnte(indice, "3")).toBe("AYUNTAMIENTO DE CUERNAVACA");
    expect(nombreEnte(indice, "999")).toBeNull();
  });
});

describe("indexarEntes", () => {
  it("ordena por nombre sin importar acentos ni mayúsculas", () => {
    const orden = indexarEntes([
      [1, "ZACATECAS", "32"],
      [2, "Águila", "00"],
      [3, "ayuntamiento", "00"],
      [4, "Ñuu", "00"],
      [5, "NAYARIT", "18"],
    ]).map((e) => e.id);
    expect(orden).toEqual([2, 3, 5, 4, 1]);
  });
});

describe("debeCargarEntes", () => {
  it("no baja el catálogo por entrar al campo o pasar por él", () => {
    expect(debeCargarEntes("", "")).toBe(false);
    expect(debeCargarEntes("   ", "")).toBe(false);
  });

  it("lo baja en cuanto la persona empieza a buscar", () => {
    expect(debeCargarEntes("s", "")).toBe(true);
  });

  it("lo baja si ya hay un ente elegido, para mostrar su nombre", () => {
    expect(debeCargarEntes("", "1234")).toBe(true);
  });
});
