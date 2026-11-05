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

/**
 * PDF con `paginas` páginas vacías, escrito a mano: pdf-lib tarda más de un minuto en generarlo
 * dentro de Vitest y aquí basta con que su analizador tenga que recorrer cada objeto. Es el mismo
 * ataque de la PoC: con 100,000 páginas el análisis previo al rechazo ronda los 2 s.
 */
export const pdfDePaginasVacias = (paginas: number): Uint8Array => {
  const objetos = [`<< /Type /Catalog /Pages 2 0 R >>`];
  const hijos: string[] = [];
  for (let i = 0; i < paginas; i += 1) {
    hijos.push(`${i + 3} 0 R`);
    objetos.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 10 10] >>`);
  }
  objetos.splice(1, 0, `<< /Type /Pages /Count ${paginas} /Kids [${hijos.join(" ")}] >>`);
  const cuerpo = objetos.map((o, i) => `${i + 1} 0 obj\n${o}\nendobj\n`).join("");
  return new TextEncoder().encode(
    `%PDF-1.4\n${cuerpo}trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\n%%EOF\n`,
  );
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
  /** Entradas adicionales de `[Content_Types].xml` y de `_rels/.rels`, para fixtures coherentes. */
  tiposExtra?: string;
  relsRaizExtra?: string;
}

export const IMPRESORA = "HP LaserJet Oficina de Juana Testigo";
export const FUENTE_LICENCIADA = "Licensee: Empresa Reveladora SA";

const RELS = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';
const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/** DOCX con configuración de impresora y una fuente incrustada, como los guarda Word. */
export const docxConImpresoraYFuentes = (): Promise<Uint8Array> =>
  officeConMetadatos({
    tiposExtra:
      '<Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/>' +
      '<Override PartName="/word/printerSettings/printerSettings1.bin" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.printerSettings"/>' +
      '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
      '<Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>',
    partes: {
      "word/document.xml":
        `<w:document ${R}><w:body><w:p><w:r><w:t>Hola</w:t></w:r></w:p>` +
        '<w:sectPr><w:printerSettings r:id="rId3"/><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body></w:document>',
      "word/_rels/document.xml.rels":
        `<Relationships ${RELS}>` +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>' +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/printerSettings" Target="printerSettings/printerSettings1.bin"/>' +
        "</Relationships>",
      "word/printerSettings/printerSettings1.bin": `\0\0${IMPRESORA}\0\0`,
      "word/settings.xml":
        '<w:settings><w:embedTrueTypeFonts/><w:saveSubsetFonts/><w:zoom w:percent="100"/></w:settings>',
      "word/fontTable.xml":
        `<w:fonts ${R}><w:font w:name="Corporativa Sans"><w:embedRegular r:id="rId1" w:fontKey="{11111111-2222-3333-4444-555555555555}"/>` +
        '<w:embedBold r:id="rId2" w:fontKey="{66666666-7777-8888-9999-000000000000}"/></w:font>' +
        '<w:font w:name="Calibri"><w:panose1 w:val="020F0502020204030204"/></w:font></w:fonts>',
      "word/_rels/fontTable.xml.rels":
        `<Relationships ${RELS}>` +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font1.odttf"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font2.odttf"/>' +
        "</Relationships>",
      "word/fonts/font1.odttf": `OTTO ${FUENTE_LICENCIADA}`,
      "word/fonts/font2.odttf": `OTTO ${FUENTE_LICENCIADA} Bold`,
    },
  });

/** XLSX cuya hoja referencia la configuración de impresora desde `pageSetup`. */
export const xlsxConImpresora = (): Promise<Uint8Array> =>
  officeConMetadatos({
    tipo: "xlsx",
    tiposExtra:
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/printerSettings/printerSettings1.bin" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.printerSettings"/>',
    partes: {
      "xl/workbook.xml": `<workbook ${R}><sheets><sheet name="Hoja1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      "xl/_rels/workbook.xml.rels":
        `<Relationships ${RELS}>` +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        "</Relationships>",
      "xl/worksheets/sheet1.xml":
        `<worksheet ${R}><sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData>` +
        '<pageMargins left="0.7" right="0.7"/><pageSetup orientation="portrait" r:id="rId1"/></worksheet>',
      "xl/worksheets/_rels/sheet1.xml.rels":
        `<Relationships ${RELS}>` +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/printerSettings" Target="../printerSettings/printerSettings1.bin"/>' +
        "</Relationships>",
      "xl/printerSettings/printerSettings1.bin": `\0\0${IMPRESORA}\0\0`,
    },
  });

/** PPTX con fuentes incrustadas y configuración de impresora, como las guarda PowerPoint. */
export const pptxConFuentesEImpresora = (): Promise<Uint8Array> =>
  officeConMetadatos({
    tipo: "pptx",
    tiposExtra:
      '<Default Extension="fntdata" ContentType="application/x-fontdata"/>' +
      '<Override PartName="/ppt/printerSettings/printerSettings1.bin" ContentType="application/vnd.openxmlformats-officedocument.presentationml.printerSettings"/>' +
      '<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>',
    partes: {
      "ppt/presentation.xml":
        `<p:presentation ${R} embedTrueTypeFonts="1" saveSubsetFonts="1"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>` +
        '<p:embeddedFontLst><p:embeddedFont><p:font typeface="Corporativa Sans"/><p:regular r:id="rId2"/><p:bold r:id="rId3"/></p:embeddedFont></p:embeddedFontLst>' +
        "</p:presentation>",
      "ppt/_rels/presentation.xml.rels":
        `<Relationships ${RELS}>` +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font1.fntdata"/>' +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font2.fntdata"/>' +
        '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/printerSettings" Target="printerSettings/printerSettings1.bin"/>' +
        "</Relationships>",
      "ppt/slides/slide1.xml": "<p:sld><p:cSld/></p:sld>",
      "ppt/fonts/font1.fntdata": `FNT ${FUENTE_LICENCIADA}`,
      "ppt/fonts/font2.fntdata": `FNT ${FUENTE_LICENCIADA} Bold`,
      "ppt/printerSettings/printerSettings1.bin": `\0\0${IMPRESORA}\0\0`,
    },
  });

export const officeConMetadatos = async (opciones: OpcionesOffice = {}): Promise<Uint8Array> => {
  const { principal, mime } = TIPOS_OFFICE[opciones.tipo ?? "docx"];
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="jpeg" ContentType="image/jpeg"/>` +
      `<Override PartName="/${principal}" ContentType="${mime}"/>` +
      `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
      `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
      `<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/>` +
      (opciones.tiposExtra ?? "") +
      `</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="r1" Type="office" Target="${principal}"/>` +
      `<Relationship Id="r2" Type="core" Target="docProps/core.xml"/>` +
      `<Relationship Id="r3" Type="app" Target="docProps/app.xml"/>` +
      (opciones.relsRaizExtra ?? "") +
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
