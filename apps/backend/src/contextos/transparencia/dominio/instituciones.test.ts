import { describe, expect, it } from "vitest";
import {
  consolidarCompradores,
  consolidarConteosS3,
  cruzarPorNombreYJurisdiccion,
  esNombreDeInstitucion,
  normalizarNombre,
  regexExacta,
} from "./instituciones.js";

describe("normalizarNombre", () => {
  it("quita acentos, mayúsculas y puntuación", () => {
    expect(normalizarNombre("Secretaría de  Salud.")).toBe("SECRETARIA DE SALUD");
  });

  it("une la variante con sufijo de carpeta: 'ECATEPEC DE MORELOS - ECATEPEC'", () => {
    expect(normalizarNombre("APAXCO - APAXCO")).toBe("APAXCO");
    expect(normalizarNombre("ZUMPANGO - ZUMPANGO")).toBe("ZUMPANGO");
    expect(normalizarNombre("TLALNEPANTLA DE BAZ - TLALNEPANTLA")).toBe("TLALNEPANTLA DE BAZ");
    expect(normalizarNombre("ATIZAPÁN DE ZARAGOZA - ATIZAPANDEZARAGOZA")).toBe(
      "ATIZAPAN DE ZARAGOZA",
    );
  });
});

describe("esNombreDeInstitucion", () => {
  it("descarta códigos internos y cargos, que no nombran una institución", () => {
    expect(esNombreDeInstitucion("MUN-020")).toBe(false);
    expect(esNombreDeInstitucion("OAU-003")).toBe(false);
    expect(esNombreDeInstitucion("POLICIA TERCERO")).toBe(false);
    expect(esNombreDeInstitucion("AYUNTAMIENTO DE ELOTA")).toBe(true);
    expect(esNombreDeInstitucion("TOLUCA")).toBe(true);
  });
});

describe("regexExacta", () => {
  it("escapa metacaracteres y ancla para no contar nombres contenidos en otros", () => {
    expect(regexExacta("El Colegio de San Luis, A.C.")).toBe("^El Colegio de San Luis, A\\.C\\.$");
    expect(regexExacta("SALUD (FEDERAL)")).toBe("^SALUD \\(FEDERAL\\)$");
  });
});

describe("consolidarConteosS3", () => {
  const filas = [
    { carpeta: "Mexico", ente: "APAXCO", n: 321 },
    { carpeta: "Mexico", ente: "APAXCO - APAXCO", n: 16 },
    { carpeta: "Mexico", ente: "TULTITLÁN", n: 53 },
    { carpeta: "Mexico", ente: "TULTITL?N", n: 2 },
    { carpeta: "Mexico", ente: "MUN-020", n: 5 },
    { carpeta: "Morelos", ente: "POLICIA TERCERO", n: 1 },
    { carpeta: "Morelos", ente: "AYUNTAMIENTO DE CUERNAVACA", n: 3 },
  ];

  it("consolida variantes por estado, incluidas las que perdieron acentos por codificación", () => {
    const r = consolidarConteosS3(filas, { umbral: 5 });
    const mex = r.instituciones.filter((i) => i.estado === "15");
    expect(mex).toEqual([
      { estado: "15", nombre: "APAXCO", conteo: 337 },
      { estado: "15", nombre: "TULTITLAN", conteo: 55 },
    ]);
  });

  it("nunca expone conteos por institución menores al umbral", () => {
    const r = consolidarConteosS3(filas, { umbral: 5 });
    expect(r.instituciones).toContainEqual({
      estado: "17",
      nombre: "AYUNTAMIENTO DE CUERNAVACA",
      conteo: null,
    });
  });

  it("cuenta aparte los registros sin nombre interpretable y conserva el total por estado", () => {
    const r = consolidarConteosS3(filas, { umbral: 5 });
    expect(r.registrosConNombreNoInterpretable).toBe(6);
    expect(r.porEstado).toContainEqual({ estado: "15", registros: 397, instituciones: 2 });
    expect(r.porEstado).toContainEqual({ estado: "17", registros: 4, instituciones: 1 });
  });

  it("rechaza una carpeta de proveedor sin estado conocido", () => {
    expect(() =>
      consolidarConteosS3([{ carpeta: "Atlantida", ente: "X", n: 1 }], { umbral: 5 }),
    ).toThrow(/Atlantida/);
  });
});

describe("consolidarCompradores", () => {
  it("no duplica variantes de mayúsculas: S6 ignora mayúsculas y da el mismo total a ambas", () => {
    expect(
      consolidarCompradores([
        { nombre: "Diconsa, S.A. de C.V.", procedimientos: 100, jurisdicciones: [] },
        { nombre: "DICONSA, S.A. DE C.V.", procedimientos: 100, jurisdicciones: [] },
      ]),
    ).toEqual([{ nombre: "Diconsa, S.A. de C.V.", procedimientos: 100, jurisdicciones: [] }]);
  });

  it("suma variantes con otra escritura: son búsquedas distintas", () => {
    const [unico, ...resto] = consolidarCompradores([
      { nombre: "Secretaría de Salud", procedimientos: 30, jurisdicciones: ["00"] },
      { nombre: "SECRETARIA DE SALUD", procedimientos: 12, jurisdicciones: [] },
    ]);
    expect(resto).toEqual([]);
    expect(unico?.procedimientos).toBe(42);
    expect(unico?.jurisdicciones).toEqual(["00"]);
  });
});

describe("normalizarNombre con razón social", () => {
  it("une S.A. de C.V. y SA DE CV", () => {
    expect(normalizarNombre("Diconsa, S.A. de C.V.")).toBe(normalizarNombre("DICONSA SA DE CV"));
  });
});

describe("cruzarPorNombreYJurisdiccion con nombres repetidos", () => {
  it("descarta un nombre que Cobertura registra en varias jurisdicciones: no se sabe cuál compró", () => {
    const r = cruzarPorNombreYJurisdiccion(
      [{ estado: "14", nombre: "SECRETARIA DE SALUD", conteo: 6 }],
      [{ nombre: "Secretaría de Salud", procedimientos: 4915, jurisdicciones: ["00", "08", "14"] }],
    );
    expect(r.coincidencias).toEqual([]);
    expect(r.homonimosDescartados).toBe(1);
  });
});

describe("cruzarPorNombreYJurisdiccion", () => {
  const s3 = [
    { estado: "14", nombre: "SECRETARIA DE SALUD", conteo: 6 },
    { estado: "14", nombre: "SECRETARIA DE CULTURA", conteo: 7 },
    { estado: "17", nombre: "INSTITUTO LOCAL", conteo: 9 },
  ];
  const s6 = [
    { nombre: "SECRETARIA DE SALUD", procedimientos: 100, jurisdicciones: ["00"] },
    { nombre: "INSTITUTO LOCAL", procedimientos: 3, jurisdicciones: ["17"] },
    { nombre: "SECRETARIA DE CULTURA", procedimientos: 10, jurisdicciones: [] },
  ];

  it("separa homónimos: mismo nombre con jurisdicción distinta no es la misma institución", () => {
    const r = cruzarPorNombreYJurisdiccion(s3, s6);
    expect(r.coincidencias).toEqual([
      { nombre: "INSTITUTO LOCAL", estado: "17", sanciones: 9, procedimientos: 3 },
    ]);
    expect(r.homonimosDescartados).toBe(1);
    expect(r.sinJurisdiccionConocida).toBe(1);
  });
});
