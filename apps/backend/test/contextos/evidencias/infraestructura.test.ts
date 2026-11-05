import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ErrorDominio } from "../../../src/compartido/dominio/errores.js";
import { DetectorFileType } from "../../../src/contextos/evidencias/infraestructura/detector-file-type.js";
import { limpiarImagen } from "../../../src/contextos/evidencias/infraestructura/limpiador-imagen.js";
import { limpiarOffice } from "../../../src/contextos/evidencias/infraestructura/limpiador-office.js";
import { limpiarPdf } from "../../../src/contextos/evidencias/infraestructura/limpiador-pdf.js";
import {
  AUTOR,
  jpegConMetadatos,
  officeConMetadatos,
  pdfCifradoDeclarado,
  pdfConMetadatos,
  pngConMetadatos,
  webpConMetadatos,
} from "../../ayudas/fixtures.js";

const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");
const codigo = async (promesa: Promise<unknown>) =>
  promesa.then(
    () => undefined,
    (e: unknown) => (e instanceof ErrorDominio ? e.codigo : "otro"),
  );

describe("DetectorFileType", () => {
  const detector = new DetectorFileType();

  it("reconoce imágenes y PDF por sus bytes", async () => {
    expect(await detector.detectar(await jpegConMetadatos())).toBe("image/jpeg");
    expect(await detector.detectar(await pngConMetadatos())).toBe("image/png");
    expect(await detector.detectar(await webpConMetadatos())).toBe("image/webp");
    expect(await detector.detectar(await pdfConMetadatos())).toBe("application/pdf");
  });

  it.each(["docx", "xlsx", "pptx"] as const)("reconoce %s", async (tipo) => {
    const detectado = await detector.detectar(await officeConMetadatos({ tipo }));
    expect(detectado).toMatch(/^application\/vnd\.openxmlformats-officedocument\./);
  });

  it("detecta un ejecutable aunque se presente con otro nombre", async () => {
    const mz = new Uint8Array(256);
    mz.set([0x4d, 0x5a]);
    expect(await detector.detectar(mz)).not.toBe("image/jpeg");
  });

  it("no reconoce texto plano", async () => {
    expect(await detector.detectar(new TextEncoder().encode("hola mundo"))).toBeNull();
  });
});

describe("limpiarImagen", () => {
  it.each([
    ["image/jpeg", jpegConMetadatos],
    ["image/png", pngConMetadatos],
    ["image/webp", webpConMetadatos],
  ] as const)("quita EXIF y GPS de %s", async (tipo, fixture) => {
    const entrada = await fixture();
    expect((await sharp(entrada).metadata()).exif).toBeDefined();
    expect(latin1(entrada)).toContain(AUTOR);

    const salida = await limpiarImagen(tipo, entrada);

    const meta = await sharp(salida.bytes).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(meta.format).toBe(tipo === "image/jpeg" ? "jpeg" : tipo.split("/")[1]);
    expect(latin1(salida.bytes)).not.toContain(AUTOR);
    expect(latin1(salida.bytes)).not.toContain("CamaraEspia");
    expect(salida.eliminados.join(" ")).toMatch(/EXIF/);
    expect(salida.residuales).toEqual([]);
  });

  it("descarta datos pegados después de la imagen", async () => {
    const entrada = Buffer.concat([await jpegConMetadatos(), Buffer.from("PK DatosOcultos")]);
    expect(latin1((await limpiarImagen("image/jpeg", entrada)).bytes)).not.toContain(
      "DatosOcultos",
    );
  });

  it("rechaza una imagen corrupta", async () => {
    expect(await codigo(limpiarImagen("image/png", new Uint8Array([0x89, 0x50, 0x4e])))).toBe(
      "evidencia_danada",
    );
  });
});

describe("limpiarPdf", () => {
  it("reescribe el documento sin metadatos, adjuntos, scripts ni revisiones", async () => {
    const entrada = await pdfConMetadatos();
    expect(latin1(entrada)).toContain("Autor Revision Vieja");

    const salida = await limpiarPdf(entrada);
    const texto = latin1(salida.bytes);

    for (const fuga of [
      AUTOR,
      "Titulo Revelador",
      "ProgramaRevelador",
      "ProductorRevelador",
      "PalabraReveladora",
      "Autor Revision Vieja",
      "Comentario Revelador",
      "JavascriptRevelador",
      "secreto.txt",
      "CamaraEspia",
      "/Metadata",
      "/EmbeddedFile",
      "/JavaScript",
      "pdf-lib",
    ]) {
      expect(texto, fuga).not.toContain(fuga);
    }
    expect(salida.residuales).toEqual([]);
    expect(salida.eliminados.join(" | ")).toMatch(/autor/i);
    expect(salida.eliminados.join(" | ")).toMatch(/revisiones/i);
    expect(salida.eliminados.join(" | ")).toMatch(/adjuntos/i);
  });

  it("conserva las páginas y queda abrible", async () => {
    const salida = await limpiarPdf(await pdfConMetadatos());
    const doc = await PDFDocument.load(salida.bytes, { updateMetadata: false });
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getAuthor()).toBeUndefined();
    expect(doc.getProducer()).toBeUndefined();
    expect(doc.getCreationDate()).toBeUndefined();
  });

  it("rechaza un PDF cifrado, que no se puede inspeccionar", async () => {
    expect(await codigo(limpiarPdf(await pdfCifradoDeclarado()))).toBe("evidencia_cifrada");
  });

  it("rechaza un PDF ilegible", async () => {
    expect(await codigo(limpiarPdf(new TextEncoder().encode("%PDF-1.7\nbasura")))).toBe(
      "evidencia_danada",
    );
  });
});

describe("limpiarOffice", () => {
  it("quita docProps y sus referencias, y anonimiza autores", async () => {
    const entrada = await officeConMetadatos();
    const salida = await limpiarOffice(entrada);
    const zip = await JSZip.loadAsync(salida.bytes);

    expect(Object.keys(zip.files).filter((n) => n.startsWith("docProps"))).toEqual([]);
    const rels = await zip.file("_rels/.rels")?.async("string");
    const tipos = await zip.file("[Content_Types].xml")?.async("string");
    const documento = await zip.file("word/document.xml")?.async("string");
    expect(rels).toContain("word/document.xml");
    expect(rels).not.toContain("docProps");
    expect(tipos).not.toContain("docProps");
    expect(documento).toContain("Hola");
    expect(documento).not.toContain(AUTOR);
    expect(salida.eliminados.join(" | ")).toMatch(/propiedades/i);
    expect(salida.eliminados.join(" | ")).toMatch(/autores/i);
    expect(salida.residuales).toEqual([]);
  });

  it("sigue siendo reconocible como su tipo original", async () => {
    const salida = await limpiarOffice(await officeConMetadatos({ tipo: "xlsx" }));
    expect(await new DetectorFileType().detectar(salida.bytes)).toMatch(/spreadsheetml/);
  });

  it("normaliza las fechas internas del ZIP", async () => {
    const zip = await JSZip.loadAsync((await limpiarOffice(await officeConMetadatos())).bytes);
    const anios = Object.values(zip.files).map((f) => f.date.getUTCFullYear());
    expect(new Set(anios)).toEqual(new Set([1980]));
  });

  it("limpia imágenes y documentos incrustados", async () => {
    const hoja = await officeConMetadatos({ tipo: "xlsx" });
    const salida = await limpiarOffice(
      await officeConMetadatos({
        partes: {
          "word/media/foto.jpeg": await jpegConMetadatos(),
          "word/embeddings/hoja.xlsx": hoja,
        },
      }),
    );
    const zip = await JSZip.loadAsync(salida.bytes);
    const foto = await zip.file("word/media/foto.jpeg")?.async("uint8array");
    expect((await sharp(foto).metadata()).exif).toBeUndefined();
    const incrustado = await zip.file("word/embeddings/hoja.xlsx")?.async("uint8array");
    const interno = await JSZip.loadAsync(incrustado as Uint8Array);
    expect(Object.keys(interno.files).filter((n) => n.startsWith("docProps"))).toEqual([]);
  });

  it.each(["word/vbaProject.bin", "word/embeddings/oleObject1.bin", "word/media/virus.exe"])(
    "rechaza un archivo con %s",
    async (parte) => {
      const entrada = await officeConMetadatos({ partes: { [parte]: "contenido" } });
      expect(await codigo(limpiarOffice(entrada))).toBe("contenido_activo");
    },
  );

  it("rechaza un ZIP inválido", async () => {
    expect(await codigo(limpiarOffice(new TextEncoder().encode("PK no es zip")))).toBe(
      "evidencia_danada",
    );
  });
});
