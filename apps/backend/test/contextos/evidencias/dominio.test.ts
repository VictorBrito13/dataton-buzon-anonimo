import { describe, expect, it } from "vitest";
import { ErrorDominio } from "../../../src/compartido/dominio/errores.js";
import { quitarMetadatosJpeg } from "../../../src/contextos/evidencias/dominio/jpeg.js";
import {
  anonimizarAutoresOffice,
  clasificarParteOffice,
  esParteDeMetadatosOffice,
  esParteProhibidaOffice,
  limpiarXmlOffice,
  neutralizarRelacionesExternas,
  quitarReferenciasMetadatos,
  rastrosEnXmlOffice,
} from "../../../src/contextos/evidencias/dominio/office.js";
import {
  categoriaDe,
  exigirComplejidadPdf,
  exigirCuotaHuerfanas,
  exigirSinResiduales,
  exigirTamano,
  LIMITES_PDF,
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

  it("acota páginas y objetos de un PDF antes de reescribirlo", () => {
    expect(LIMITES_PDF).toEqual({ paginas: 500, objetos: 50_000 });
    expect(codigoDe(() => exigirComplejidadPdf({ paginas: 500, objetos: 50_000 }))).toBeUndefined();
    expect(codigoDe(() => exigirComplejidadPdf({ paginas: 501, objetos: 10 }))).toBe(
      "evidencia_demasiado_compleja",
    );
    expect(codigoDe(() => exigirComplejidadPdf({ paginas: 1, objetos: 50_001 }))).toBe(
      "evidencia_demasiado_compleja",
    );
  });

  it("cierra la recepción cuando las subidas sin denuncia agotan la cuota global", () => {
    const cuota = { filas: 2000, bytes: 2 * 1024 ** 3 };
    expect(codigoDe(() => exigirCuotaHuerfanas({ filas: 1999, bytes: 1 }, cuota))).toBeUndefined();
    expect(codigoDe(() => exigirCuotaHuerfanas({ filas: 2000, bytes: 1 }, cuota))).toBe(
      "cuota_subidas_agotada",
    );
    expect(codigoDe(() => exigirCuotaHuerfanas({ filas: 1, bytes: 2 * 1024 ** 3 }, cuota))).toBe(
      "cuota_subidas_agotada",
    );
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
      anonimizarAutoresOffice("ppt/commentAuthors.xml", '<p:cmAuthor name="Juana" initials="JP"/>')
        .xml,
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

describe("rutas locales y rastros de edición en Office", () => {
  const RELS =
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="attachedTemplate" Target="file:///C:\\Users\\juana.testigo\\Normal.dotm" TargetMode="External"/>' +
    '<Relationship Id="rId2" Type="hyperlink" Target="https://ejemplo.org/pagina" TargetMode="External"/>' +
    '<Relationship Id="rId3" Type="hyperlink" Target="mailto:juana@ejemplo.org" TargetMode="External"/>' +
    '<Relationship Id="rId4" Type="oleObject" Target="\\\\servidor\\compartida\\datos.xlsx" TargetMode="External"/>' +
    '<Relationship Id="rId5" Type="image" Target="media/image1.png"/>' +
    '<Relationship Id="rId6" Type="hyperlink" Target="D:\\Denuncias\\anexo.pdf" TargetMode="External"/>' +
    "</Relationships>";

  it("vacía toda relación con file:, ruta de disco, UNC o externa que no sea http(s)", () => {
    const { xml, cambio } = neutralizarRelacionesExternas(RELS);
    expect(cambio).toBe(true);
    expect(xml).not.toMatch(/juana|Normal\.dotm|servidor|Denuncias|mailto|file:/);
    expect(xml).toContain('Id="rId1"');
    expect(xml).toContain('Id="rId4"');
    expect(xml).toContain('Target="https://ejemplo.org/pagina"');
    expect(xml).toContain('Target="media/image1.png"');
    expect(xml.match(/about:blank/g)).toHaveLength(4);
  });

  it("deja intacto un .rels sin rutas externas", () => {
    const rels = '<Relationships><Relationship Id="r" Target="word/document.xml"/></Relationships>';
    expect(neutralizarRelacionesExternas(rels)).toEqual({ xml: rels, cambio: false });
  });

  it("quita absPath de Excel, con su envoltorio AlternateContent, y fileSharing", () => {
    const entrada =
      '<workbook xmlns:x15ac="http://schemas.microsoft.com/office/spreadsheetml/2010/11/ac">' +
      '<fileSharing userName="Juana Testigo" reservationPassword="ABCD"/>' +
      '<mc:AlternateContent xmlns:mc="m"><mc:Choice Requires="x15">' +
      '<x15ac:absPath url="C:\\Users\\juana.testigo\\Documents\\"/>' +
      "</mc:Choice></mc:AlternateContent>" +
      '<sheets><sheet name="Hoja1" sheetId="1" r:id="rId1"/></sheets></workbook>';
    const { xml, eliminados } = limpiarXmlOffice("xl/workbook.xml", entrada);
    expect(xml).not.toMatch(/absPath|juana|AlternateContent|fileSharing|Juana/);
    expect(xml).toContain('<sheet name="Hoja1"');
    expect(eliminados).toContain("Rutas de archivos del equipo");
  });

  it("quita absPath aunque venga suelto y con otro prefijo", () => {
    const { xml } = limpiarXmlOffice(
      "xl/workbook.xml",
      '<workbook><x15ac:absPath url="C:\\Users\\j\\"/><sheets/></workbook>',
    );
    expect(xml).toBe("<workbook><sheets/></workbook>");
  });

  it("quita los rsids de Word: el bloque de settings y los atributos de párrafos", () => {
    const settings = limpiarXmlOffice(
      "word/settings.xml",
      '<w:settings><w:rsids><w:rsidRoot w:val="00A1B2C3"/><w:rsid w:val="00D4E5F6"/></w:rsids><w:zoom/></w:settings>',
    );
    expect(settings.xml).toBe("<w:settings><w:zoom/></w:settings>");
    expect(settings.eliminados).toContain("Identificadores de sesión de edición");
    const documento = limpiarXmlOffice(
      "word/document.xml",
      '<w:p w:rsidR="00A1B2C3" w:rsidRDefault="00D4E5F6"><w:r w:rsidRPr="0011"><w:t>Hola</w:t></w:r></w:p>',
    );
    expect(documento.xml).toBe("<w:p><w:r><w:t>Hola</w:t></w:r></w:p>");
  });

  it("anonimiza el nombre de usuario del historial de revisiones de Excel", () => {
    const { xml } = limpiarXmlOffice(
      "xl/revisions/revisionHeaders.xml",
      '<headers><header guid="{1}" dateTime="2026-01-01T10:00:00" userName="Juana Testigo"/></headers>',
    );
    expect(xml).not.toMatch(/Juana|2026-01-01/);
  });

  it("sigue anonimizando autores desde la misma función", () => {
    const { xml, eliminados } = limpiarXmlOffice(
      "word/comments.xml",
      '<w:comment w:author="Juana Pérez" w:initials="JP" w:date="2026-01-01T10:00:00Z"/>',
    );
    expect(xml).not.toMatch(/Juana|JP|2026-01-01/);
    expect(eliminados).toContain("Autores y fechas de comentarios y control de cambios");
  });

  it("detecta rastros que sobreviven en cualquier parte de texto", () => {
    expect(rastrosEnXmlOffice('<a Target="file:///C:/x"/>')).toEqual([
      "Rutas de archivos del equipo",
    ]);
    expect(rastrosEnXmlOffice('<a url="C:\\Users\\j"/>')).toEqual(["Rutas de archivos del equipo"]);
    expect(rastrosEnXmlOffice('<a url="\\\\servidor\\x"/>')).toEqual([
      "Rutas de archivos del equipo",
    ]);
    expect(rastrosEnXmlOffice('<x15ac:absPath url="x"/>')).toEqual([
      "Rutas de archivos del equipo",
    ]);
    expect(rastrosEnXmlOffice('<w:p w:rsidR="1"/>')).toEqual([
      "Identificadores de sesión de edición",
    ]);
    expect(rastrosEnXmlOffice('<Relationship Target="docProps/core.xml"/>')).toEqual([
      "Propiedades",
    ]);
    expect(
      rastrosEnXmlOffice('<a Target="https://x/y" b="about:blank"/><w:t>C: 10 pesos</w:t>'),
    ).toEqual([]);
  });

  it.each([
    ["word/media/image1.jpeg", { clase: "imagen", tipo: "image/jpeg" }],
    ["ppt/media/image2.PNG", { clase: "imagen", tipo: "image/png" }],
    ["xl/media/foto.webp", { clase: "imagen", tipo: "image/webp" }],
    [
      "word/media/image1.tiff",
      { clase: "residual", motivo: "Imágenes en formatos que no se limpian" },
    ],
    [
      "word/media/image3.gif",
      { clase: "residual", motivo: "Imágenes en formatos que no se limpian" },
    ],
    [
      "word/media/image4.emf",
      { clase: "residual", motivo: "Imágenes en formatos que no se limpian" },
    ],
    [
      "word/media/image5.wmf",
      { clase: "residual", motivo: "Imágenes en formatos que no se limpian" },
    ],
    [
      "word/media/image6.bmp",
      { clase: "residual", motivo: "Imágenes en formatos que no se limpian" },
    ],
    ["word/embeddings/hoja.xlsx", { clase: "incrustado" }],
    ["ppt/embeddings/Documento.docx", { clase: "incrustado" }],
    [
      "word/embeddings/Microsoft_Word_Macro-Enabled_Document.docm",
      { clase: "residual", motivo: "Documentos incrustados que no se limpian" },
    ],
    [
      "word/embeddings/libro.xlsm",
      { clase: "residual", motivo: "Documentos incrustados que no se limpian" },
    ],
    [
      "word/embeddings/pres.pptm",
      { clase: "residual", motivo: "Documentos incrustados que no se limpian" },
    ],
    [
      "word/embeddings/plantilla.dotm",
      { clase: "residual", motivo: "Documentos incrustados que no se limpian" },
    ],
    [
      "word/embeddings/anexo.pdf",
      { clase: "residual", motivo: "Documentos incrustados que no se limpian" },
    ],
    [
      "word/embeddings/objeto.bin",
      { clase: "residual", motivo: "Documentos incrustados que no se limpian" },
    ],
    ["word/document.xml", { clase: "xml" }],
    ["word/_rels/document.xml.rels", { clase: "xml" }],
    ["[Content_Types].xml", { clase: "xml" }],
    ["word/fontTable.xml", { clase: "xml" }],
    ["word/theme/theme1.xml", { clase: "xml" }],
    ["word/fonts/fuente.odttf", { clase: "otro" }],
  ] as const)("clasifica %s", (parte, esperado) => {
    expect(clasificarParteOffice(parte)).toEqual(esperado);
  });
});
