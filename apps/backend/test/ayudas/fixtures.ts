import JSZip from "jszip";
import { PDFDocument, PDFName, PDFString, StandardFonts } from "pdf-lib";
import sharp from "sharp";

export const AUTOR = "Juana Testigo Perez";

const base = (formato: "jpeg" | "png" | "webp") =>
  sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 200, g: 30, b: 30 } },
  }).toFormat(formato);

const EXIF = {
  IFD0: { Artist: AUTOR, Make: "CamaraEspia", Copyright: AUTOR },
  IFD3: { GPSLatitudeRef: "N", GPSLatitude: "19/1 25/1 0/1" },
};

export const jpegConMetadatos = (): Promise<Buffer> =>
  base("jpeg").withExif(EXIF).withXmp(`<x:xmpmeta>${AUTOR}</x:xmpmeta>`).toBuffer();
export const pngConMetadatos = (): Promise<Buffer> => base("png").withExif(EXIF).toBuffer();
export const webpConMetadatos = (): Promise<Buffer> => base("webp").withExif(EXIF).toBuffer();
export const jpegSinMetadatos = (): Promise<Buffer> => base("jpeg").toBuffer();

/** PDF con Info, XMP, adjunto, JavaScript, anotación, formulario, foto con EXIF y revisión vieja. */
export const pdfConMetadatos = async (): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  doc.setAuthor(AUTOR);
  doc.setTitle("Titulo Revelador");
  doc.setCreator("ProgramaRevelador");
  doc.setProducer("ProductorRevelador");
  doc.setKeywords(["PalabraReveladora"]);
  const pagina = doc.addPage([300, 300]);
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  pagina.drawText("Contenido visible", { x: 20, y: 250, size: 12, font: fuente });
  pagina.drawImage(await doc.embedJpg(await jpegConMetadatos()), {
    x: 20,
    y: 20,
    width: 50,
    height: 50,
  });
  const campo = doc.getForm().createTextField("nombre");
  campo.setText("Texto del formulario");
  campo.addToPage(pagina, { x: 20, y: 100, width: 200, height: 30, font: fuente });

  const xmp = doc.context.stream(`<x:xmpmeta>${AUTOR} xmp</x:xmpmeta>`, {
    Type: "Metadata",
    Subtype: "XML",
  });
  doc.catalog.set(PDFName.of("Metadata"), doc.context.register(xmp));
  const nota = doc.context.register(
    doc.context.obj({
      Type: "Annot",
      Subtype: "Text",
      Rect: [0, 0, 10, 10],
      T: PDFString.of(`${AUTOR} nota`),
      Contents: PDFString.of("Comentario Revelador"),
    }),
  );
  pagina.node.addAnnot(nota);
  await doc.attach(new TextEncoder().encode("adjunto oculto"), "secreto.txt", {
    mimeType: "text/plain",
  });
  doc.addJavaScript("alerta", 'app.alert("JavascriptRevelador");');

  const bytes = await doc.save({ useObjectStreams: false });
  const revisionVieja = new TextEncoder().encode(
    "\n900 0 obj\n<< /Author (Autor Revision Vieja) >>\nendobj\n%%EOF\n",
  );
  const salida = new Uint8Array(bytes.length + revisionVieja.length);
  salida.set(bytes);
  salida.set(revisionVieja, bytes.length);
  return salida;
};

export const pdfCifradoDeclarado = async (): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.context.trailerInfo.Encrypt = doc.context.register(doc.context.obj({ Filter: "Standard" }));
  return doc.save({ useObjectStreams: false });
};

export const TIPOS_OFFICE = {
  docx: {
    principal: "word/document.xml",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
  },
  xlsx: {
    principal: "xl/workbook.xml",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
  },
  pptx: {
    principal: "ppt/presentation.xml",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
  },
} as const;

export interface OpcionesOffice {
  tipo?: keyof typeof TIPOS_OFFICE;
  partes?: Record<string, string | Uint8Array>;
}

export const officeConMetadatos = async (opciones: OpcionesOffice = {}): Promise<Uint8Array> => {
  const { principal, mime } = TIPOS_OFFICE[opciones.tipo ?? "docx"];
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/${principal}" ContentType="${mime}"/>` +
      `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
      `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
      `</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="r1" Type="office" Target="${principal}"/>` +
      `<Relationship Id="r2" Type="core" Target="docProps/core.xml"/>` +
      `<Relationship Id="r3" Type="app" Target="docProps/app.xml"/>` +
      `</Relationships>`,
  );
  zip.file(
    principal,
    `<documento><w:ins w:author="${AUTOR}" w:date="2026-01-01T10:00:00Z"/>Hola</documento>`,
  );
  zip.file("docProps/core.xml", `<coreProperties><creator>${AUTOR}</creator></coreProperties>`);
  zip.file("docProps/app.xml", `<Properties><Company>EmpresaReveladora</Company></Properties>`);
  zip.file(
    "docProps/custom.xml",
    `<Properties><Secreto>PropiedadReveladora</Secreto></Properties>`,
  );
  zip.file("docProps/thumbnail.jpeg", "MiniaturaReveladora");
  for (const [nombre, contenido] of Object.entries(opciones.partes ?? {})) {
    zip.file(nombre, contenido);
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
};
