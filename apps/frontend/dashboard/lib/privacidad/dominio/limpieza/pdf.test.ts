import { PDFDocument, PDFName, PDFString, PDFHexString, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { LATITUD_DE_PRUEBA, contiene, jpegConMetadatos, unir } from "./ejemplos";
import { ErrorLimpieza } from "./errores";
import { limpiarPdf } from "./pdf";

const AUTOR = "Autora Secreta";
const XMP = "<x:xmpmeta>Autora XMP Secreta</x:xmpmeta>";
const AUTOR_ANTERIOR = "Autor De Revision Vieja";

const hexUtf16 = (s: string) =>
  `FEFF${[...s].map((c) => c.charCodeAt(0).toString(16).padStart(4, "0")).join("")}`.toUpperCase();

/** En un PDF el dato puede estar como texto literal o en hexadecimal UTF-16. */
const tieneTexto = (bytes: Uint8Array, s: string) =>
  contiene(bytes, s) || contiene(bytes, hexUtf16(s));

const pdfConMetadatos = async (opciones: { imagen?: boolean; adjunto?: boolean } = {}) => {
  const doc = await PDFDocument.create();
  doc.setAuthor(AUTOR);
  doc.setTitle("Titulo Secreto");
  doc.setSubject("Asunto Secreto");
  doc.setKeywords(["clave-secreta"]);
  doc.setCreator("CreadorSecreto");
  doc.setProducer("ProductorSecreto");
  doc.setCreationDate(new Date("2026-03-14T10:00:00Z"));
  doc.setModificationDate(new Date("2026-03-15T10:00:00Z"));
  const pagina = doc.addPage([200, 200]);
  pagina.drawRectangle({ x: 10, y: 10, width: 50, height: 50, color: rgb(1, 0, 0) });

  const xmp = doc.context.stream(XMP, { Type: "Metadata", Subtype: "XML" });
  doc.catalog.set(PDFName.of("Metadata"), doc.context.register(xmp));

  pagina.node.set(
    PDFName.of("PieceInfo"),
    doc.context.obj({ Privada: PDFString.of("PiezaSecreta") }),
  );
  const nota = doc.context.obj({
    Type: "Annot",
    Subtype: "Text",
    Rect: [0, 0, 10, 10],
    T: PDFHexString.fromText("Revisora Secreta"),
    Contents: PDFString.of("contenido visible"),
  });
  pagina.node.set(PDFName.of("Annots"), doc.context.obj([doc.context.register(nota)]));

  if (opciones.imagen) {
    const foto = await doc.embedJpg(jpegConMetadatos());
    pagina.drawImage(foto, { x: 0, y: 0, width: 10, height: 10 });
  }
  if (opciones.adjunto) {
    // Uint8Array.from: en jsdom, TextEncoder devuelve un arreglo de otro contexto que pdf-lib rechaza.
    await doc.attach(Uint8Array.from(new TextEncoder().encode("ADJUNTO SECRETO")), "secreto.txt", {
      mimeType: "text/plain",
    });
  }
  return doc.save({ useObjectStreams: false, updateFieldAppearances: false });
};

/** Simula una revisión incremental: lo anterior sigue en el archivo aunque ya no se use. */
const conRevisionIncremental = (base: Uint8Array) =>
  unir(
    base,
    new TextEncoder().encode(
      `\n9001 0 obj\n<< /Author (${AUTOR_ANTERIOR}) >>\nendobj\nstartxref\n0\n%%EOF\n`,
    ),
  );

describe("limpiarPdf", () => {
  it("el ejemplo sí trae los metadatos antes de limpiar", async () => {
    const original = await pdfConMetadatos();
    for (const s of [AUTOR, "Titulo Secreto", "ProductorSecreto", "xmpmeta", "PiezaSecreta"]) {
      expect(tieneTexto(original, s), s).toBe(true);
    }
  });

  it("quita autor, título, productor, creador, fechas y XMP de los bytes", async () => {
    const { bytes } = await limpiarPdf(await pdfConMetadatos());
    for (const s of [
      AUTOR,
      "Titulo Secreto",
      "Asunto Secreto",
      "clave-secreta",
      "CreadorSecreto",
      "ProductorSecreto",
      "xmpmeta",
      "/Author",
      "/Producer",
      "/Creator",
      "/CreationDate",
      "/ModDate",
      "/Metadata",
      "/Info",
      "pdf-lib",
    ]) {
      expect(tieneTexto(bytes, s), s).toBe(false);
    }
  });

  it("reporta lo que había, leído del documento", async () => {
    const { eliminados } = await limpiarPdf(await pdfConMetadatos());
    expect(eliminados).toEqual(
      expect.arrayContaining([
        "Autor",
        "Título",
        "Asunto",
        "Palabras clave",
        "Programa que lo creó",
        "Programa que lo generó",
        "Fecha de creación",
        "Fecha de modificación",
        "Datos XMP",
        "Datos privados de la aplicación",
        "Autor de comentarios",
      ]),
    );
  });

  it("no reporta lo que no estaba", async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    doc.addPage();
    const { eliminados } = await limpiarPdf(await doc.save({ useObjectStreams: false }));
    expect(eliminados).toEqual([]);
  });

  it("ignora los campos vacíos", async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    doc.setAuthor("");
    doc.addPage();
    const { eliminados } = await limpiarPdf(await doc.save({ useObjectStreams: false }));
    expect(eliminados).not.toContain("Autor");
  });

  it("elimina revisiones incrementales y objetos huérfanos", async () => {
    const original = conRevisionIncremental(await pdfConMetadatos());
    expect(contiene(original, AUTOR_ANTERIOR)).toBe(true);
    const { bytes, eliminados } = await limpiarPdf(original);
    expect(contiene(bytes, AUTOR_ANTERIOR)).toBe(false);
    expect(eliminados).toContain("Revisiones anteriores del documento");
  });

  it("quita el autor de los comentarios pero conserva el comentario", async () => {
    const { bytes } = await limpiarPdf(await pdfConMetadatos());
    expect(tieneTexto(bytes, "Revisora Secreta")).toBe(false);
    expect(contiene(bytes, "contenido visible")).toBe(true);
  });

  it("limpia el GPS de las fotos incrustadas", async () => {
    const original = await pdfConMetadatos({ imagen: true });
    expect(contiene(original, LATITUD_DE_PRUEBA)).toBe(true);
    const { bytes, eliminados } = await limpiarPdf(original);
    expect(contiene(bytes, LATITUD_DE_PRUEBA)).toBe(false);
    expect(eliminados).toContain("Metadatos de fotos incrustadas");
  });

  it("quita archivos adjuntos y avisa", async () => {
    const { bytes, eliminados } = await limpiarPdf(await pdfConMetadatos({ adjunto: true }));
    expect(contiene(bytes, "secreto.txt")).toBe(false);
    expect(eliminados).toContain("Archivos adjuntos");
  });

  it("el resultado sigue siendo un PDF válido y conserva las páginas", async () => {
    const { bytes } = await limpiarPdf(await pdfConMetadatos({ imagen: true }));
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize()).toEqual({ width: 200, height: 200 });
  });

  it("limpiar dos veces no encuentra nada más", async () => {
    const una = await limpiarPdf(await pdfConMetadatos({ imagen: true, adjunto: true }));
    const dos = await limpiarPdf(una.bytes);
    expect(dos.eliminados).toEqual([]);
  });

  it("rechaza un PDF cifrado con un mensaje claro", async () => {
    const base = await pdfConMetadatos();
    const cifrado = unir(
      base,
      new TextEncoder().encode(
        "\n7777 0 obj\n<< /Filter /Standard /V 1 >>\nendobj\ntrailer\n<< /Encrypt 7777 0 R >>\nstartxref\n0\n%%EOF\n",
      ),
    );
    await expect(limpiarPdf(cifrado)).rejects.toThrow(ErrorLimpieza);
    await expect(limpiarPdf(cifrado)).rejects.toThrow(/contraseña/);
  });

  it("rechaza lo que no es un PDF", async () => {
    await expect(limpiarPdf(new TextEncoder().encode("no soy pdf"))).rejects.toThrow(ErrorLimpieza);
  });
});
