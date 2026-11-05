import { describe, expect, it } from "vitest";
import type { TipoHallazgo } from "./hallazgo";
import { detectarDatos } from "./reglas";

const textos = (entrada: string, tipo: TipoHallazgo) =>
  detectarDatos(entrada)
    .filter((h) => h.tipo === tipo)
    .map((h) => h.texto);

const noDetecta = (entrada: string) => expect(detectarDatos(entrada)).toEqual([]);

describe("CURP", () => {
  it("detecta una CURP con estructura real", () => {
    expect(textos("Mi CURP es GOMC850214HDFNRR09, por favor.", "curp")).toEqual([
      "GOMC850214HDFNRR09",
    ]);
  });
  it("detecta minúsculas y personas nacidas en el extranjero (NE)", () => {
    expect(textos("gomc850214hdfnrr09", "curp")).toHaveLength(1);
    expect(textos("GOMC850214MNENRR09", "curp")).toHaveLength(1);
  });
  it("rechaza una clave de estado inexistente", () => noDetecta("GOMC850214HZZNRR09"));
  it("rechaza una fecha imposible", () => {
    noDetecta("GOMC851399HDFNRR09");
    noDetecta("GOMC850230HDFNRR09");
  });
  it("rechaza si el sexo o las consonantes no corresponden", () => {
    noDetecta("GOMC850214ZDFNRR09");
    noDetecta("GOMC850214HDFARR09");
  });
  it("no salta dentro de una cadena más larga", () => noDetecta("XGOMC850214HDFNRR09Y"));
});

describe("RFC", () => {
  it("detecta persona física", () => {
    expect(textos("RFC: GOMC850214AB3.", "rfc")).toEqual(["GOMC850214AB3"]);
  });
  it("detecta persona moral", () => {
    expect(textos("La empresa ABC850214K12 facturó.", "rfc")).toEqual(["ABC850214K12"]);
  });
  it("detecta con guiones o espacios", () => {
    expect(textos("GOMC-850214-AB3", "rfc")).toHaveLength(1);
    expect(textos("GOMC 850214 AB3", "rfc")).toHaveLength(1);
  });
  it("rechaza una fecha imposible", () => noDetecta("GOMC851399AB3"));
  it("ignora los RFC genéricos del SAT", () => {
    noDetecta("XAXX010101000");
    noDetecta("XEXX010101000");
  });
  it("rechaza una homoclave con forma inválida", () => noDetecta("GOMC850214ABZ"));
  it("no marca como RFC una CURP", () => {
    expect(textos("GOMC850214HDFNRR09", "rfc")).toEqual([]);
  });
});

describe("teléfono", () => {
  it.each([
    "5512345678",
    "55 1234 5678",
    "55-1234-5678",
    "55.1234.5678",
    "(55) 1234 5678",
    "(55) 1234-5678",
    "(555) 123 4567",
    "555-123-4567",
    "55 12 34 56 78",
    "+52 55 1234 5678",
    "+525512345678",
    "+52 1 55 1234 5678",
    "+52 (55) 1234-5678",
    "52 55 1234 5678",
    "01 55 1234 5678",
    "044 55 1234 5678",
    "045 33 1234 5678",
  ])("detecta %s", (numero) => {
    expect(textos(`Llámenme al ${numero} por favor`, "telefono")).toEqual([numero]);
  });
  it("detecta números de 8 dígitos solo si se habla de un teléfono", () => {
    expect(textos("Mi teléfono: 1234-5678", "telefono")).toEqual(["1234-5678"]);
    noDetecta("La partida 1234-5678 del presupuesto");
  });
  it("detecta el número aunque haya un folio antes en la frase", () => {
    expect(textos("folio 123 y teléfono 5512345678", "telefono")).toEqual(["5512345678"]);
  });
  it.each([
    "Folio 2026031401",
    "folio: 5512345678",
    "expediente 5512345678",
    "oficio núm. 5512345678",
    "contrato no. 5512345678",
    "factura #5512345678",
    "cuenta 5512345678",
    "un monto de 5512345678 pesos",
    "se desviaron 5512345678 MXN",
    "fueron 5512345678 millones",
    "$5512345678",
    "$ 5,512,345,678.00",
    "$1,250,000.00",
    "en el año 2026",
    "entre 2024 y 2026",
    "2024-2026",
    "1234567890",
    "0512345678",
    "5555555555",
    "IP 192.168.100.200",
    "551234567",
    "55123456789012345",
    "3.1415926535",
  ])("no marca como teléfono: %s", (texto) => {
    expect(textos(texto, "telefono")).toEqual([]);
  });
});

describe("correo", () => {
  it.each([
    "juan.perez@example.com",
    "maria_lopez+denuncia@correo.gob.mx",
    "JOSÉ@dominio.mx",
    "a@b.co",
  ])("detecta %s", (correo) => {
    expect(textos(`Escribe a ${correo}.`, "correo")).toEqual([correo]);
  });
  it.each(["usuario@", "@dominio.com", "sin arroba.com", "a@b", "nombre@dominio.c"])(
    "no marca %s",
    (texto) => noDetecta(texto),
  );
  it("no marca una mención de red social como correo", () => noDetecta("síguelo en @dependencia"));
});

describe("CLABE", () => {
  it("detecta una CLABE con dígito de control correcto", () => {
    expect(textos("CLABE 032180000118359719", "clabe")).toEqual(["032180000118359719"]);
  });
  it("detecta una CLABE agrupada", () => {
    expect(textos("032 180 00011835971 9", "clabe")).toEqual(["032 180 00011835971 9"]);
    expect(textos("0321 8000 0118 3597 19", "clabe")).toEqual(["0321 8000 0118 3597 19"]);
  });
  it("rechaza un dígito de control incorrecto", () => noDetecta("032180000118359718"));
  it("rechaza 17 o 19 dígitos", () => {
    expect(textos("03218000011835971", "clabe")).toEqual([]);
    expect(textos("0321800001183597190", "clabe")).toEqual([]);
  });
});

describe("tarjeta", () => {
  it.each(["4111111111111111", "5555555555554444", "378282246310005", "4111 1111 1111 1111"])(
    "detecta %s",
    (tarjeta) => {
      expect(textos(`pagó con ${tarjeta} ayer`, "tarjeta")).toEqual([tarjeta]);
    },
  );
  it("detecta el formato de American Express", () => {
    expect(textos("3782 822463 10005", "tarjeta")).toEqual(["3782 822463 10005"]);
  });
  it("rechaza si falla Luhn", () => noDetecta("4111111111111112"));
  it("rechaza dígitos repetidos y prefijos que no son de tarjeta", () => {
    noDetecta("4444444444444444");
    noDetecta("1111111111111117");
  });
  it("no confunde una CLABE con una tarjeta", () => {
    expect(textos("032180000118359719", "tarjeta")).toEqual([]);
  });
});

describe("NSS", () => {
  it("detecta 11 dígitos con verificador correcto", () => {
    expect(textos("Mi NSS es 12345678903", "nss")).toEqual(["12345678903"]);
  });
  it("detecta el formato con guiones", () => {
    expect(textos("NSS 12-34-56-7890-3", "nss")).toEqual(["12-34-56-7890-3"]);
  });
  it("rechaza un verificador incorrecto", () => noDetecta("12345678904"));
  it("no marca un folio con la misma forma", () => noDetecta("folio 12345678903"));
});

describe("placa", () => {
  it.each(["ABC-123-A", "ABC-12-34", "XYZ987A"])("detecta %s", (placa) => {
    expect(textos(`el auto ${placa} estaba ahí`, "placa")).toEqual([placa]);
  });
  it("con la palabra placa acepta formatos ambiguos y minúsculas", () => {
    expect(textos("con placas 123-ABC", "placa")).toEqual(["123-ABC"]);
    expect(textos("placas: abc-123-a", "placa")).toEqual(["abc-123-a"]);
    expect(textos("placa de circulación A12-BCD", "placa")).toEqual(["A12-BCD"]);
  });
  it.each([
    "conforme a la NOM-001-A vigente",
    "EXP-123-A",
    "123-ABC",
    "abc-123-a",
    "COVID-19",
    "ISO-27001",
    "las placas de metal",
    "BZ-A1B2-C3D4-E5F6-G7H8",
  ])("no marca %s", (texto) => {
    expect(textos(texto, "placa")).toEqual([]);
  });
});

describe("hallazgos", () => {
  it("incluye posiciones exactas, nivel dato, explicación y sugerencia", () => {
    const entrada = "Tel: 5512345678.";
    const [hallazgo] = detectarDatos(entrada);
    expect(hallazgo).toMatchObject({ tipo: "telefono", nivel: "dato", sugerencia: "[teléfono]" });
    expect(entrada.slice(hallazgo.inicio, hallazgo.fin)).toBe("5512345678");
    expect(hallazgo.explicacion.length).toBeGreaterThan(10);
  });
  it("devuelve resultados ordenados y sin solapes", () => {
    const hallazgos = detectarDatos(
      "GOMC850214HDFNRR09 GOMC850214AB3 032180000118359719 4111111111111111 12345678903 5512345678 a@b.co ABC-123-A",
    );
    expect(hallazgos.map((h) => h.tipo)).toEqual([
      "curp",
      "rfc",
      "clabe",
      "tarjeta",
      "nss",
      "telefono",
      "correo",
      "placa",
    ]);
    for (let i = 1; i < hallazgos.length; i++) {
      expect(hallazgos[i].inicio).toBeGreaterThanOrEqual(hallazgos[i - 1].fin);
    }
  });
  it("funciona con espacios no separables y guiones tipográficos", () => {
    expect(textos("55 1234‑5678", "telefono")).toHaveLength(1);
  });
  it("texto muy largo sin datos termina rápido", () => {
    const inicio = performance.now();
    detectarDatos("a.".repeat(100_000) + "1 ".repeat(100_000));
    expect(performance.now() - inicio).toBeLessThan(2000);
  });
});
