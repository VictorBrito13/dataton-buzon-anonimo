// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { aBase64Url, generarParDeClaves, sellar } from "@dataton/shared";
import { ErrorSello, abrirEvidencia, abrirTexto, interpretarRelato } from "./sellos";

let propia: { publica: JsonWebKey; privada: JsonWebKey };
let ajena: { publica: JsonWebKey; privada: JsonWebKey };

const selloDe = (bytes: Uint8Array<ArrayBuffer>) => sellar(propia.publica, bytes);
const selloDeTexto = (texto: string) => selloDe(new TextEncoder().encode(texto));

beforeAll(async () => {
  propia = await generarParDeClaves();
  ajena = await generarParDeClaves();
});

describe("abrirTexto", () => {
  it("sin clave, el contenido sigue sellado", async () => {
    const sello = aBase64Url(await selloDeTexto("relato"));
    expect(await abrirTexto(null, sello)).toEqual({ estado: "sellado" });
  });

  it("con la clave correcta, abre incluyendo acentos", async () => {
    const sello = aBase64Url(await selloDeTexto("Acción en la oficina"));
    expect(await abrirTexto(propia.privada, sello)).toEqual({
      estado: "abierto",
      texto: "Acción en la oficina",
    });
  });

  it("con otra clave no abre, y no lanza", async () => {
    const sello = aBase64Url(await selloDeTexto("relato"));
    expect(await abrirTexto(ajena.privada, sello)).toEqual({ estado: "no_abre" });
  });

  it("un sello dañado o texto no UTF-8 no abre", async () => {
    expect(await abrirTexto(propia.privada, "%%%")).toEqual({ estado: "no_abre" });
    const noUtf8 = aBase64Url(await selloDe(new Uint8Array([0xff, 0xfe, 0xfd])));
    expect(await abrirTexto(propia.privada, noUtf8)).toEqual({ estado: "no_abre" });
  });
});

describe("interpretarRelato", () => {
  it("texto libre queda como texto", () => {
    expect(interpretarRelato("Vi el pago.")).toEqual({ tipo: "texto", texto: "Vi el pago." });
  });

  it("un objeto JSON se muestra por campos", () => {
    const relato = JSON.stringify({ hechos: "Vi el pago.", personas: ["Cargo A", "Cargo B"] });
    expect(interpretarRelato(relato)).toEqual({
      tipo: "campos",
      campos: [
        { nombre: "hechos", valor: "Vi el pago." },
        { nombre: "personas", valor: "Cargo A, Cargo B" },
      ],
    });
  });

  it("JSON que no es objeto queda como texto", () => {
    expect(interpretarRelato("123")).toEqual({ tipo: "texto", texto: "123" });
    expect(interpretarRelato("[1,2]")).toEqual({ tipo: "texto", texto: "[1,2]" });
    expect(interpretarRelato("null")).toEqual({ tipo: "texto", texto: "null" });
  });
});

describe("abrirEvidencia", () => {
  const id = "6f1c1c1e-3f0a-4a53-9a55-0d3f6a1b2c3d";

  it("abre los bytes y nombra el archivo por tipo", async () => {
    const original = new Uint8Array([1, 2, 3, 250]);
    const abierta = await abrirEvidencia(propia.privada, await selloDe(original), {
      id,
      tipo: "application/pdf",
    });
    expect(abierta.nombre).toBe("evidencia-6f1c1c1e.pdf");
    expect(new Uint8Array(await abierta.archivo.arrayBuffer())).toEqual(original);
  });

  it("nunca entrega un tipo que el navegador pudiera ejecutar", async () => {
    const sello = await selloDeTexto("<script>alert(1)</script>");
    for (const tipo of ["text/html", "image/svg+xml", "../../x"]) {
      const abierta = await abrirEvidencia(propia.privada, sello, { id, tipo });
      expect(abierta.archivo.type).toBe("application/octet-stream");
      expect(abierta.nombre).toBe("evidencia-6f1c1c1e.bin");
    }
  });

  it("con otra clave lanza ErrorSello", async () => {
    const sello = await selloDe(new Uint8Array([1]));
    await expect(
      abrirEvidencia(ajena.privada, sello, { id, tipo: "application/pdf" }),
    ).rejects.toBeInstanceOf(ErrorSello);
  });
});
