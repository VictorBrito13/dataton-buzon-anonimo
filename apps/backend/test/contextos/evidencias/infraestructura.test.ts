import JSZip from "jszip";
import { PDFDocument, PDFNumber } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
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

  it("rechaza más de 500 páginas antes de copiarlas", async () => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < 501; i += 1) doc.addPage([10, 10]);
    const copiar = vi.spyOn(PDFDocument.prototype, "copyPages");
    try {
      expect(await codigo(limpiarPdf(await doc.save({ useObjectStreams: true })))).toBe(
        "evidencia_demasiado_compleja",
      );
      expect(copiar).not.toHaveBeenCalled();
    } finally {
      copiar.mockRestore();
    }
  });

  it("rechaza un PDF con demasiados objetos indirectos", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([10, 10]);
    for (let i = 0; i < 50_001; i += 1) doc.context.register(PDFNumber.of(i));
    expect(await codigo(limpiarPdf(await doc.save({ useObjectStreams: false })))).toBe(
      "evidencia_demasiado_compleja",
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

  it("quita la ruta absoluta que Excel guarda en workbook.xml", async () => {
    const salida = await limpiarOffice(
      await officeConMetadatos({
        tipo: "xlsx",
        partes: {
          "xl/workbook.xml":
            '<workbook xmlns:x15ac="http://schemas.microsoft.com/office/spreadsheetml/2010/11/ac">' +
            '<x15ac:absPath url="C:\\Users\\juana.testigo\\Documents\\Denuncias\\"/>' +
            '<sheets><sheet name="Hoja1" sheetId="1" r:id="rId1"/></sheets></workbook>',
        },
      }),
    );
    const zip = await JSZip.loadAsync(salida.bytes);
    const workbook = await zip.file("xl/workbook.xml")?.async("string");
    expect(workbook).not.toMatch(/juana|absPath/);
    expect(workbook).toContain('<sheet name="Hoja1"');
    expect(salida.residuales).toEqual([]);
    expect(salida.eliminados).toContain("Rutas de archivos del equipo");
  });

  it("vacía las rutas locales de plantillas y vínculos en cualquier .rels, y quita rsids", async () => {
    const salida = await limpiarOffice(
      await officeConMetadatos({
        partes: {
          "word/_rels/settings.xml.rels":
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" ' +
            'Target="file:///C:\\Users\\juana.testigo\\AppData\\Roaming\\Microsoft\\Templates\\Normal.dotm" TargetMode="External"/>' +
            "</Relationships>",
          "word/_rels/document.xml.rels":
            '<Relationships><Relationship Id="rId9" Type="hyperlink" Target="\\\\servidor\\denuncias\\anexo.pdf" TargetMode="External"/></Relationships>',
          "word/settings.xml":
            '<w:settings><w:attachedTemplate r:id="rId1"/><w:rsids><w:rsidRoot w:val="00A1B2C3"/><w:rsid w:val="00D4E5F6"/></w:rsids></w:settings>',
        },
      }),
    );
    const zip = await JSZip.loadAsync(salida.bytes);
    const partes: Record<string, string> = {};
    for (const [nombre, entrada] of Object.entries(zip.files)) {
      if (!entrada.dir) partes[nombre] = await entrada.async("string");
    }
    const todo = Object.values(partes).join("\n");
    expect(todo).not.toMatch(/juana|Normal\.dotm|servidor|rsid|file:/);
    expect(partes["word/_rels/settings.xml.rels"]).toContain('Id="rId1"');
    expect(partes["word/settings.xml"]).toContain("<w:attachedTemplate");
    expect(salida.residuales).toEqual([]);
    expect(salida.eliminados).toContain("Rutas de archivos del equipo");
    expect(salida.eliminados).toContain("Identificadores de sesión de edición");
  });

  it.each(["image1.tiff", "image2.gif", "image3.bmp", "image4.emf", "image5.wmf"])(
    "marca como residual una imagen %s que no sabe limpiar",
    async (nombre) => {
      const salida = await limpiarOffice(
        await officeConMetadatos({
          partes: { [`word/media/${nombre}`]: "II*\0 EXIF GPSLatitude Artist=Juana Testigo" },
        }),
      );
      expect(salida.residuales).toEqual(["Imágenes en formatos que no se limpian"]);
    },
  );

  it.each(["Documento.docm", "Libro.xlsm", "Pres.pptm", "Plantilla.dotm", "anexo.pdf", "cosa.bin"])(
    "marca como residual un incrustado %s que no reprocesa",
    async (nombre) => {
      const salida = await limpiarOffice(
        await officeConMetadatos({
          partes: { [`word/embeddings/${nombre}`]: new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3]) },
        }),
      );
      expect(salida.residuales).toEqual(["Documentos incrustados que no se limpian"]);
    },
  );

  it("mantiene las referencias entre partes al dejar el documento abrible", async () => {
    const salida = await limpiarOffice(await officeConMetadatos());
    const zip = await JSZip.loadAsync(salida.bytes);
    const tipos = await zip.file("[Content_Types].xml")?.async("string");
    expect(tipos).toContain("<Types");
    expect(tipos).toContain("</Types>");
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

  describe("bombas ZIP", () => {
    const MB = 1024 * 1024;
    const conRelleno = async (megas: number) =>
      officeConMetadatos({ partes: { "word/relleno.xml": new Uint8Array(megas * MB) } });

    it("acepta un documento de hasta 50 MB inflados", async () => {
      expect((await limpiarOffice(await conRelleno(20))).residuales).toEqual([]);
    });

    it("rechaza más de 50 MB declarados", async () => {
      expect(await codigo(limpiarOffice(await conRelleno(51)))).toBe("evidencia_danada");
    });

    it("rechaza por el tamaño real inflado aunque las cabeceras mientan", async () => {
      const bomba = await conRelleno(60);
      // Reescribe el tamaño sin comprimir de word/relleno.xml a 1 KB en la cabecera local y en
      // el directorio central: lo que lee JSZip para los tamaños declarados.
      const texto = Buffer.from(bomba).toString("latin1");
      const nombre = "word/relleno.xml";
      const mentira = Buffer.alloc(4);
      mentira.writeUInt32LE(1024);
      const local = texto.indexOf(nombre) - 30;
      expect(texto.slice(local, local + 4)).toBe("PK\x03\x04");
      bomba.set(mentira, local + 22);
      const central = texto.indexOf(nombre, local + 30 + nombre.length) - 46;
      expect(texto.slice(central, central + 4)).toBe("PK\x01\x02");
      bomba.set(mentira, central + 24);
      const zip = await JSZip.loadAsync(bomba);
      const entrada = zip.file(nombre) as unknown as { _data: { uncompressedSize: number } };
      expect(entrada._data.uncompressedSize).toBe(1024);

      expect(await codigo(limpiarOffice(bomba))).toBe("evidencia_danada");
    });
  });
});
