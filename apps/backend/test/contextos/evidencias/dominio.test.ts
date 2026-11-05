import { describe, expect, it } from "vitest";
import { ErrorDominio } from "../../../src/compartido/dominio/errores.js";
import { quitarMetadatosJpeg } from "../../../src/contextos/evidencias/dominio/jpeg.js";
import {
  anonimizarAutoresOffice,
  esParteDeMetadatosOffice,
  esParteProhibidaOffice,
  quitarReferenciasMetadatos,
} from "../../../src/contextos/evidencias/dominio/office.js";
import {
  categoriaDe,
  exigirSinResiduales,
  exigirTamano,
  TIPOS_EVIDENCIA,
} from "../../../src/contextos/evidencias/dominio/politica.js";

const codigoDe = (accion: () => unknown): string | undefined => {
  try {
    accion();
    return undefined;
  } catch (error) {
    return error instanceof ErrorDominio ? error.codigo : "otro";
  }
};

describe("política de evidencias", () => {
  it("permite exactamente imágenes, PDF y Office", () => {
    expect(TIPOS_EVIDENCIA.map(categoriaDe)).toEqual([
      "imagen",
      "imagen",
      "imagen",
      "pdf",
      "office",
      "office",
      "office",
    ]);
  });

  it.each([
    "application/x-msdownload",
    "application/x-elf",
    "application/zip",
    "image/gif",
    "text/html",
    "application/vnd.ms-word.document.macroenabled.12",
  ])("rechaza %s", (tipo) => {
    expect(categoriaDe(tipo)).toBeNull();
  });

  it("rechaza vacíos y excedidos, y acepta el máximo exacto", () => {
    expect(codigoDe(() => exigirTamano(0, 10))).toBe("evidencia_vacia");
    expect(codigoDe(() => exigirTamano(11, 10))).toBe("evidencia_demasiado_grande");
    expect(codigoDe(() => exigirTamano(10, 10))).toBeUndefined();
  });

  it("rechaza un archivo al que le quedan metadatos tras limpiarlo", () => {
    expect(codigoDe(() => exigirSinResiduales(["EXIF"]))).toBe("metadatos_residuales");
    expect(codigoDe(() => exigirSinResiduales([]))).toBeUndefined();
  });
});

describe("quitarMetadatosJpeg", () => {
  const segmento = (marca: number, contenido: string): number[] => {
    const datos = [...new TextEncoder().encode(contenido)];
    const largo = datos.length + 2;
    return [0xff, marca, largo >> 8, largo & 0xff, ...datos];
  };
  const inicio = [0xff, 0xd8];
  const imagen = [0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9];

  it("quita EXIF, XMP, Photoshop y comentarios; conserva APP0, ICC, Adobe y la imagen", () => {
    const entrada = new Uint8Array([
      ...inicio,
      ...segmento(0xe0, "JFIF"),
      ...segmento(0xe1, "Exif GPS"),
      ...segmento(0xe2, "ICC"),
      ...segmento(0xed, "Photoshop"),
      ...segmento(0xee, "Adobe"),
      ...segmento(0xfe, "Comentario"),
      ...imagen,
    ]);
    const salida = quitarMetadatosJpeg(entrada);
    const texto = new TextDecoder("latin1").decode(salida.bytes);
    expect(salida.cambio).toBe(true);
    expect(texto).not.toMatch(/Exif|Photoshop|Comentario/);
    expect(texto).toMatch(/JFIF/);
    expect(texto).toMatch(/ICC/);
    expect(texto).toMatch(/Adobe/);
    expect([...salida.bytes.slice(-imagen.length)]).toEqual(imagen);
  });

  it("descarta datos ocultos después del fin de imagen", () => {
    const entrada = new Uint8Array([...inicio, ...imagen, 0x41, 0x42, 0x43]);
    const salida = quitarMetadatosJpeg(entrada);
    expect([...salida.bytes]).toEqual([...inicio, ...imagen]);
    expect(salida.cambio).toBe(true);
  });

  it("devuelve intacto lo que no es JPEG", () => {
    const entrada = new Uint8Array([1, 2, 3]);
    expect(quitarMetadatosJpeg(entrada)).toEqual({ bytes: entrada, cambio: false });
  });

  it("no se desborda con una longitud de segmento truncada", () => {
    const entrada = new Uint8Array([...inicio, 0xff, 0xe1, 0xff, 0xff, 0x00]);
    expect(quitarMetadatosJpeg(entrada).cambio).toBe(false);
  });
});

describe("reglas de Office", () => {
  it.each([
    "docProps/core.xml",
    "docProps/app.xml",
    "docProps/custom.xml",
    "docProps/thumbnail.jpeg",
    "customXml/item1.xml",
  ])("%s es metadato", (parte) => {
    expect(esParteDeMetadatosOffice(parte)).toBe(true);
  });

  it("el documento no es metadato", () => {
    expect(esParteDeMetadatosOffice("word/document.xml")).toBe(false);
  });

  it.each([
    "word/vbaProject.bin",
    "xl/vbaData.xml",
    "word/activeX/activeX1.xml",
    "word/embeddings/oleObject1.bin",
    "ppt/media/programa.exe",
    "word/embeddings/herramienta.dll",
  ])("%s está prohibida", (parte) => {
    expect(esParteProhibidaOffice(parte)).toBe(true);
  });

  it("las imágenes y hojas incrustadas no están prohibidas", () => {
    expect(esParteProhibidaOffice("word/media/image1.jpeg")).toBe(false);
    expect(esParteProhibidaOffice("ppt/embeddings/Hoja1.xlsx")).toBe(false);
  });

  it("retira relaciones y tipos que apuntan a partes eliminadas", () => {
    const rels =
      '<Relationships><Relationship Id="1" Target="docProps/core.xml"/>' +
      '<Relationship Id="2" Target="word/document.xml"/>' +
      '<Relationship Id="3" Target="../customXml/item1.xml"/></Relationships>';
    expect(quitarReferenciasMetadatos(rels)).toBe(
      '<Relationships><Relationship Id="2" Target="word/document.xml"/></Relationships>',
    );
    const tipos =
      '<Types><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="x"/>' +
      '<Override PartName="/word/document.xml" ContentType="y"/></Types>';
    expect(quitarReferenciasMetadatos(tipos)).toBe(
      '<Types><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="y"/></Types>',
    );
  });

  it("anonimiza autores de control de cambios y comentarios en Word", () => {
    const { xml, cambio } = anonimizarAutoresOffice(
      "word/comments.xml",
      '<w:comment w:author="Juana Pérez" w:initials="JP" w:date="2026-01-01T10:00:00Z"/>',
    );
    expect(cambio).toBe(true);
    expect(xml).not.toMatch(/Juana|JP|2026-01-01/);
  });

  it("anonimiza autores en Excel y PowerPoint", () => {
    expect(
      anonimizarAutoresOffice("xl/comments1.xml", "<authors><author>Juana</author></authors>").xml,
    ).not.toMatch(/Juana/);
    expect(
      anonimizarAutoresOffice(
        "ppt/commentAuthors.xml",
        '<p:cmAuthor name="Juana" initials="JP"/>',
      ).xml,
    ).not.toMatch(/Juana|JP/);
  });

  it("no toca partes sin autores", () => {
    const entrada = '<w:p w:author="no-aplica"/>';
    expect(anonimizarAutoresOffice("[Content_Types].xml", entrada)).toEqual({
      xml: entrada,
      cambio: false,
    });
  });
});
