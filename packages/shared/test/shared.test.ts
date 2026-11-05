import { wordlist } from "@scure/bip39/wordlists/spanish.js";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  abrir,
  aBase64Url,
  CLAVES_ETAPA,
  consultaListadoAutoridad,
  deBase64Url,
  derivarAccesoId,
  esquemaFolio,
  fraseValida,
  generarFrase,
  generarParDeClaves,
  LISTADO_AUTORIDAD,
  normalizarFrase,
  normalizarPalabra,
  respuestaListadoAutoridad,
  sellar,
  TIPOS_FALTA,
  TRANSICIONES,
} from "../src/index.js";

describe("zod", () => {
  it("no usa eval: la CSP estricta lo bloquearía en el navegador", () => {
    expect(z.config().jitless).toBe(true);
  });
});

describe("paginación del listado de autoridad", () => {
  it("sin parámetros, primera página con el tamaño por defecto", () => {
    expect(consultaListadoAutoridad.parse({})).toEqual({
      pagina: 1,
      porPagina: LISTADO_AUTORIDAD.porPaginaPorDefecto,
    });
  });

  it("acepta los parámetros de la URL como texto y los filtros de catálogo", () => {
    expect(
      consultaListadoAutoridad.parse({
        pagina: "3",
        porPagina: "25",
        etapa: "recibida",
        estado: "17",
        tipoFalta: "cohecho",
      }),
    ).toEqual({ pagina: 3, porPagina: 25, etapa: "recibida", estado: "17", tipoFalta: "cohecho" });
  });

  it.each([
    { pagina: "0" },
    { pagina: "-1" },
    { pagina: "1.5" },
    { pagina: "abc" },
    { pagina: String(LISTADO_AUTORIDAD.paginaMaxima + 1) },
    { porPagina: "0" },
    { porPagina: String(LISTADO_AUTORIDAD.porPaginaMaximo + 1) },
    { etapa: "inventada" },
    { estado: "99" },
    { tipoFalta: "<script>" },
  ])("rechaza %j", (consulta) => {
    expect(consultaListadoAutoridad.safeParse(consulta).success).toBe(false);
  });

  it("la respuesta conserva el total y dice qué página es", () => {
    const respuesta = respuestaListadoAutoridad.parse({
      denuncias: [],
      total: 1234,
      pagina: 2,
      porPagina: 50,
    });
    expect(respuesta).toEqual({ denuncias: [], total: 1234, pagina: 2, porPagina: 50 });
    expect(respuestaListadoAutoridad.safeParse({ denuncias: [], total: 1 }).success).toBe(false);
  });
});

describe("frase de recuperación", () => {
  it("las 2048 palabras siguen siendo únicas sin acentos", () => {
    expect(new Set(wordlist.map(normalizarPalabra)).size).toBe(2048);
  });

  it("genera frases válidas y distintas", () => {
    const frase = generarFrase();
    expect(fraseValida(frase)).toBe(true);
    expect(frase.split(" ")).toHaveLength(6);
    expect(generarFrase()).not.toBe(frase);
  });

  it("rechaza palabras fuera de la lista o una cantidad incorrecta", () => {
    expect(fraseValida("hola mundo")).toBe(false);
    expect(fraseValida("zzzz zzzz zzzz zzzz zzzz zzzz")).toBe(false);
  });

  it("deriva lo mismo aunque cambien acentos, mayúsculas o espacios", async () => {
    const frase = "ábaco abdomen abeja abierto abogado abono";
    expect(normalizarFrase("  ÁBACO abdomen  abeja abierto abogado   abono ")).toBe(
      normalizarFrase(frase),
    );
    const a = await derivarAccesoId(frase);
    const b = await derivarAccesoId("ABACO ABDOMEN ABEJA ABIERTO ABOGADO ABONO");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("frases distintas derivan identificadores distintos", async () => {
    const a = await derivarAccesoId("abaco abdomen abeja abierto abogado abono");
    const b = await derivarAccesoId("abaco abdomen abeja abierto abogado aborto");
    expect(a).not.toBe(b);
  });
});

describe("sello", () => {
  const texto = new TextEncoder().encode("relato confidencial");

  it("solo la clave privada correcta abre el sello", async () => {
    const { publica, privada } = await generarParDeClaves();
    const otra = await generarParDeClaves();
    const sello = await sellar(publica, texto);
    expect(new TextDecoder().decode(await abrir(privada, sello))).toBe("relato confidencial");
    await expect(abrir(otra.privada, sello)).rejects.toThrow();
  });

  it("detecta alteraciones", async () => {
    const { publica, privada } = await generarParDeClaves();
    const sello = await sellar(publica, texto);
    sello[sello.length - 1]! ^= 1;
    await expect(abrir(privada, sello)).rejects.toThrow();
  });

  it("dos sellos del mismo texto son distintos y no contienen el texto", async () => {
    const { publica } = await generarParDeClaves();
    const [a, b] = await Promise.all([sellar(publica, texto), sellar(publica, texto)]);
    expect(aBase64Url(a)).not.toBe(aBase64Url(b));
    expect(new TextDecoder().decode(a)).not.toContain("relato");
  });

  it("base64url no desborda la pila con un sello cercano al límite del contrato", () => {
    const bytes = new Uint8Array(200_000).fill(251);
    expect(deBase64Url(aBase64Url(bytes))).toEqual(bytes);
  });

  it("base64url ida y vuelta", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(301));
    expect(deBase64Url(aBase64Url(bytes))).toEqual(bytes);
  });
});

describe("catálogos y folio", () => {
  it("toda transición apunta a una etapa existente", () => {
    for (const destinos of Object.values(TRANSICIONES)) {
      for (const d of destinos) expect(CLAVES_ETAPA).toContain(d);
    }
  });

  it("cubre las tres categorías que distingue el S5", () => {
    const gravedades = Object.values(TIPOS_FALTA).map((t) => t.gravedad as string);
    for (const categoria of ["grave", "no_grave", "hecho_corrupcion"]) {
      expect(gravedades).toContain(categoria);
    }
  });

  it("valida el formato del folio", () => {
    expect(esquemaFolio.safeParse("BZ-7K2M-9QRT-3HVX-ANZ4").success).toBe(true);
    expect(esquemaFolio.safeParse("BZ-123").success).toBe(false);
    expect(esquemaFolio.safeParse("BZ-ILOU-9QRT-3HVX-ANZ4").success).toBe(false);
  });
});
