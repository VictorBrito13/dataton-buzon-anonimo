import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { LATITUD_DE_PRUEBA, contiene, jpegConMetadatos } from "./ejemplos";
import { ErrorLimpieza } from "./errores";
import { limpiarOffice } from "./office";

const AUTORA = "Autora Secreta";
const REVISOR = "Revisor Secreto";

const CORE = `<?xml version="1.0"?><cp:coreProperties xmlns:cp="c" xmlns:dc="d" xmlns:dcterms="t"><dc:title>Titulo Secreto</dc:title><dc:creator>${AUTORA}</dc:creator><cp:lastModifiedBy>${REVISOR}</cp:lastModifiedBy><dcterms:created>2026-03-14T10:00:00Z</dcterms:created><dcterms:modified>2026-03-15T10:00:00Z</dcterms:modified></cp:coreProperties>`;
const APP = `<?xml version="1.0"?><Properties><Application>Microsoft Office Word</Application><Company>Empresa Secreta</Company><Manager>Gerente Secreto</Manager><TotalTime>42</TotalTime></Properties>`;
const CUSTOM = `<?xml version="1.0"?><Properties><property name="Secreta"><vt:lpwstr>Valor Secreto</vt:lpwstr></property></Properties>`;
const TIPOS_BASE = (principal: string) =>
  `<?xml version="1.0"?><Types><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/${principal}"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>`;
const RELS_RAIZ = (principal: string) =>
  `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="officeDocument" Target="${principal}"/><Relationship Id="rId2" Type="core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="extended-properties" Target="docProps/app.xml"/><Relationship Id="rId4" Type="custom-properties" Target="docProps/custom.xml"/><Relationship Id="rId5" Type="thumbnail" Target="docProps/thumbnail.jpeg"/></Relationships>`;

const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
};

const base = (principal: string, mime: string) => {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    TIPOS_BASE(principal).replace(
      `PartName="/${principal}"`,
      `PartName="/${principal}" ContentType="${mime}"`,
    ),
    { date: new Date("2026-03-14T10:00:00Z") },
  );
  zip.file("_rels/.rels", RELS_RAIZ(principal));
  zip.file("docProps/core.xml", CORE);
  zip.file("docProps/app.xml", APP);
  zip.file("docProps/custom.xml", CUSTOM);
  zip.file("docProps/thumbnail.jpeg", jpegConMetadatos());
  return zip;
};

const docx = () => {
  const zip = base("word/document.xml", MIME.docx);
  zip.file(
    "word/document.xml",
    `<w:document><w:p w:rsidR="00A1B2C3"><w:ins w:id="1" w:author="${REVISOR}" w:date="2026-03-14T10:00:00Z"><w:r><w:t>Texto de la denuncia</w:t></w:r></w:ins></w:p></w:document>`,
  );
  zip.file(
    "word/comments.xml",
    `<w:comments><w:comment w:id="0" w:author="${AUTORA}" w:initials="AS" w:date="2026-03-14T10:00:00Z"><w:p><w:r><w:t>Comentario visible</w:t></w:r></w:p></w:comment></w:comments>`,
  );
  zip.file(
    "word/people.xml",
    `<w15:people><w15:person w15:author="${AUTORA}"><w15:presenceInfo w15:providerId="Windows Live" w15:userId="id-secreto"/></w15:person></w15:people>`,
  );
  zip.file(
    "word/settings.xml",
    `<w:settings><w:attachedTemplate r:id="rId1"/><w:rsids><w:rsidRoot w:val="00A1B2C3"/></w:rsids></w:settings>`,
  );
  zip.file(
    "word/_rels/settings.xml.rels",
    `<Relationships><Relationship Id="rId1" Type="attachedTemplate" Target="file:///C:\\Users\\maria\\plantilla.dotm" TargetMode="External"/></Relationships>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<Relationships><Relationship Id="rId1" Type="people" Target="people.xml"/><Relationship Id="rId2" Type="image" Target="media/foto.jpg"/></Relationships>`,
  );
  zip.file("word/media/foto.jpg", jpegConMetadatos());
  zip.file("customXml/item1.xml", `<props>${AUTORA}</props>`);
  return zip;
};

const xlsx = () => {
  const zip = base("xl/workbook.xml", MIME.xlsx);
  zip.file(
    "xl/workbook.xml",
    `<workbook><fileSharing userName="${AUTORA}"/><mc:AlternateContent><mc:Choice Requires="x15"><x15ac:absPath url="C:\\Users\\maria\\Desktop\\"/></mc:Choice></mc:AlternateContent><sheets/></workbook>`,
  );
  zip.file(
    "xl/comments1.xml",
    `<comments><authors><author>${AUTORA}</author></authors><commentList><comment ref="A1" authorId="0"><text><r><t>${AUTORA}:</t></r><r><t>Comentario visible</t></r></text></comment></commentList></comments>`,
  );
  zip.file(
    "xl/persons/person.xml",
    `<personList><person displayName="${AUTORA}" id="{1}" userId="id-secreto" providerId="AD"/></personList>`,
  );
  return zip;
};

const pptx = () => {
  const zip = base("ppt/presentation.xml", MIME.pptx);
  zip.file("ppt/presentation.xml", `<p:presentation/>`);
  zip.file(
    "ppt/commentAuthors.xml",
    `<p:cmAuthorLst><p:cmAuthor id="0" name="${AUTORA}" initials="AS" lastIdx="1" clrIdx="0"/></p:cmAuthorLst>`,
  );
  zip.file(
    "ppt/comments/comment1.xml",
    `<p:cmLst><p:cm authorId="0" dt="2026-03-14T10:00:00"/></p:cmLst>`,
  );
  return zip;
};

const empacar = (zip: JSZip) => zip.generateAsync({ type: "uint8array" });

const IMPRESORA = "HP LaserJet de Maria";
const FUENTE = "Licensee: Empresa Secreta";
const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const RELS = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';

/** DOCX como lo guarda Word con "Incrustar fuentes" y una impresora configurada. */
const docxConImpresoraYFuentes = () => {
  const zip = base("word/document.xml", MIME.docx);
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0"?><Types><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/><Override PartName="/word/document.xml" ContentType="${MIME.docx}"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/><Override PartName="/word/printerSettings/printerSettings1.bin" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.printerSettings"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>`,
  );
  zip.file(
    "word/document.xml",
    `<w:document ${R}><w:body><w:p><w:r><w:t>Texto de la denuncia</w:t></w:r></w:p><w:sectPr><w:printerSettings r:id="rId3"/><w:pgSz w:w="12240"/></w:sectPr></w:body></w:document>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<Relationships ${RELS}><Relationship Id="rId1" Type="settings" Target="settings.xml"/><Relationship Id="rId2" Type="fontTable" Target="fontTable.xml"/><Relationship Id="rId3" Type="printerSettings" Target="printerSettings/printerSettings1.bin"/></Relationships>`,
  );
  zip.file("word/printerSettings/printerSettings1.bin", `\0\0${IMPRESORA}\0\0`);
  zip.file(
    "word/settings.xml",
    `<w:settings><w:embedTrueTypeFonts/><w:saveSubsetFonts/><w:zoom w:percent="100"/></w:settings>`,
  );
  zip.file(
    "word/fontTable.xml",
    `<w:fonts ${R}><w:font w:name="Corporativa Sans"><w:embedRegular r:id="rId1" w:fontKey="{1}"/><w:embedBold r:id="rId2" w:fontKey="{2}"/></w:font><w:font w:name="Calibri"><w:panose1 w:val="020F0502020204030204"/></w:font></w:fonts>`,
  );
  zip.file(
    "word/_rels/fontTable.xml.rels",
    `<Relationships ${RELS}><Relationship Id="rId1" Type="font" Target="fonts/font1.odttf"/><Relationship Id="rId2" Type="font" Target="fonts/font2.odttf"/></Relationships>`,
  );
  zip.file("word/fonts/font1.odttf", `OTTO ${FUENTE}`);
  zip.file("word/fonts/font2.odttf", `OTTO ${FUENTE} Bold`);
  return zip;
};

const xlsxConImpresora = () => {
  const zip = base("xl/workbook.xml", MIME.xlsx);
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0"?><Types><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/xl/workbook.xml" ContentType="${MIME.xlsx}"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/printerSettings/printerSettings1.bin" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.printerSettings"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>`,
  );
  zip.file(
    "xl/workbook.xml",
    `<workbook ${R}><sheets><sheet name="Hoja1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<Relationships ${RELS}><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
  );
  zip.file(
    "xl/worksheets/sheet1.xml",
    `<worksheet ${R}><sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData><pageSetup orientation="portrait" r:id="rId1"/></worksheet>`,
  );
  zip.file(
    "xl/worksheets/_rels/sheet1.xml.rels",
    `<Relationships ${RELS}><Relationship Id="rId1" Type="printerSettings" Target="../printerSettings/printerSettings1.bin"/></Relationships>`,
  );
  zip.file("xl/printerSettings/printerSettings1.bin", `\0\0${IMPRESORA}\0\0`);
  return zip;
};

const pptxConFuentes = () => {
  const zip = base("ppt/presentation.xml", MIME.pptx);
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0"?><Types><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="fntdata" ContentType="application/x-fontdata"/><Override PartName="/ppt/presentation.xml" ContentType="${MIME.pptx}"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/printerSettings/printerSettings1.bin" ContentType="application/vnd.openxmlformats-officedocument.presentationml.printerSettings"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>`,
  );
  zip.file(
    "ppt/presentation.xml",
    `<p:presentation ${R} embedTrueTypeFonts="1" saveSubsetFonts="1"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:embeddedFontLst><p:embeddedFont><p:font typeface="Corporativa Sans"/><p:regular r:id="rId2"/></p:embeddedFont></p:embeddedFontLst></p:presentation>`,
  );
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    `<Relationships ${RELS}><Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="font" Target="fonts/font1.fntdata"/><Relationship Id="rId3" Type="printerSettings" Target="printerSettings/printerSettings1.bin"/></Relationships>`,
  );
  zip.file("ppt/slides/slide1.xml", "<p:sld><p:cSld/></p:sld>");
  zip.file("ppt/fonts/font1.fntdata", `FNT ${FUENTE}`);
  zip.file("ppt/printerSettings/printerSettings1.bin", `\0\0${IMPRESORA}\0\0`);
  return zip;
};

const resolverDestino = (rutaRels: string, destino: string) => {
  if (destino.startsWith("/")) return destino.slice(1);
  const piezas: string[] = [];
  for (const pieza of `${rutaRels.replace(/_rels\/[^/]*$/, "")}${destino}`.split("/")) {
    if (pieza === "..") piezas.pop();
    else if (pieza !== "." && pieza !== "") piezas.push(pieza);
  }
  return piezas.join("/");
};

/**
 * Validación de estructura sin Office: cada Override y relación interna apunta a una parte que existe,
 * cada parte tiene tipo de contenido y cada `r:id` usado está declarado en su `.rels`.
 */
const problemasDeEstructura = async (bytes: Uint8Array): Promise<string[]> => {
  const zip = await JSZip.loadAsync(bytes);
  const partes = Object.values(zip.files)
    .filter((f) => !f.dir)
    .map((f) => f.name);
  const texto = (nombre: string) => zip.file(nombre)?.async("string");
  const problemas: string[] = [];
  const tipos = (await texto("[Content_Types].xml")) ?? "";
  const porExtension = new Set(
    [...tipos.matchAll(/<Default\b[^>]*\bExtension="([^"]+)"/g)].map((m) => m[1]!.toLowerCase()),
  );
  const overrides = [...tipos.matchAll(/<Override\b[^>]*\bPartName="\/([^"]+)"/g)].map(
    (m) => m[1]!,
  );
  for (const parte of overrides)
    if (!partes.includes(parte)) problemas.push(`Override sin parte: ${parte}`);
  for (const parte of partes) {
    if (parte === "[Content_Types].xml") continue;
    const extension = parte.split(".").pop()!.toLowerCase();
    if (!overrides.includes(parte) && !porExtension.has(extension))
      problemas.push(`Parte sin tipo: ${parte}`);
  }
  for (const rels of partes.filter((p) => p.endsWith(".rels"))) {
    const xml = (await texto(rels)) ?? "";
    const ids = new Set<string>();
    for (const [relacion] of xml.matchAll(/<Relationship\b[^>]*\/>/g)) {
      const id = /\bId="([^"]*)"/.exec(relacion)?.[1] ?? "";
      const destino = /\bTarget="([^"]*)"/.exec(relacion)?.[1];
      ids.add(id);
      if (/TargetMode="External"/i.test(relacion) || destino === undefined) continue;
      if (!partes.includes(resolverDestino(rels, destino)))
        problemas.push(`${rels}: ${id} apunta a ${destino}, que no existe`);
    }
    if (rels === "_rels/.rels") continue;
    const dueno = rels.replace(/_rels\/([^/]*)\.rels$/, "$1");
    const xmlDueno = (await texto(dueno)) ?? "";
    for (const m of xmlDueno.matchAll(/\br:(?:id|embed|link|pict|href)="([^"]+)"/g)) {
      if (!ids.has(m[1]!)) problemas.push(`${dueno} usa ${m[1]}, que no está en ${rels}`);
    }
  }
  return problemas;
};

const xmlDe = async (bytes: Uint8Array) => {
  const zip = await JSZip.loadAsync(bytes);
  const partes: Record<string, string> = {};
  for (const [ruta, entrada] of Object.entries(zip.files)) {
    if (!entrada.dir && /\.(xml|rels)$/.test(ruta)) partes[ruta] = await entrada.async("string");
  }
  return { zip, partes, todo: Object.values(partes).join("\n") };
};

describe("limpiarOffice: DOCX", () => {
  it("el ejemplo sí trae los metadatos antes de limpiar", async () => {
    const { todo } = await xmlDe(await empacar(docx()));
    for (const s of [AUTORA, REVISOR, "Empresa Secreta", "Valor Secreto"]) {
      expect(todo, s).toContain(s);
    }
  });

  it("elimina docProps y deja el paquete coherente", async () => {
    const { bytes } = await limpiarOffice(await empacar(docx()));
    const { zip, partes } = await xmlDe(bytes);
    for (const ruta of ["core.xml", "app.xml", "custom.xml", "thumbnail.jpeg"]) {
      expect(zip.file(`docProps/${ruta}`), ruta).toBeNull();
    }
    expect(partes["[Content_Types].xml"]).not.toContain("docProps");
    expect(partes["_rels/.rels"]).not.toContain("docProps");
    expect(partes["_rels/.rels"]).toContain('Target="word/document.xml"');
    expect(partes["[Content_Types].xml"]).toContain("word/document.xml");
  });

  it("ningún XML conserva autores, revisores ni rutas locales", async () => {
    const { bytes } = await limpiarOffice(await empacar(docx()));
    const { todo, zip, partes } = await xmlDe(bytes);
    for (const s of [
      AUTORA,
      REVISOR,
      "Empresa Secreta",
      "Gerente Secreto",
      "Valor Secreto",
      "Titulo Secreto",
      "id-secreto",
      "maria",
      "w:rsid",
      "w:initials",
    ]) {
      expect(todo, s).not.toContain(s);
    }
    expect(partes["word/comments.xml"]).toContain('w:author="Autor"');
    expect(partes["word/comments.xml"]).not.toContain("w:date");
    expect(partes["word/document.xml"]).toContain('w:author="Autor"');
    expect(partes["word/document.xml"]).not.toContain("w:date");
    expect(zip.file("word/people.xml")).toBeNull();
    expect(partes["word/_rels/document.xml.rels"]).not.toContain("people.xml");
    expect(zip.file("customXml/item1.xml")).toBeNull();
  });

  it("conserva el contenido visible", async () => {
    const { bytes } = await limpiarOffice(await empacar(docx()));
    const { partes } = await xmlDe(bytes);
    expect(partes["word/document.xml"]).toContain("Texto de la denuncia");
    expect(partes["word/comments.xml"]).toContain("Comentario visible");
  });

  it("limpia el GPS de las fotos incrustadas", async () => {
    const original = await empacar(docx());
    const antes = await (
      await JSZip.loadAsync(original)
    )
      .file("word/media/foto.jpg")!
      .async("uint8array");
    expect(contiene(antes, LATITUD_DE_PRUEBA)).toBe(true);
    const { bytes, eliminados } = await limpiarOffice(original);
    const despues = await (
      await JSZip.loadAsync(bytes)
    )
      .file("word/media/foto.jpg")!
      .async("uint8array");
    expect(contiene(despues, LATITUD_DE_PRUEBA)).toBe(false);
    expect(eliminados).toContain("Metadatos de fotos incrustadas");
  });

  it("borra las fechas y comentarios del propio ZIP", async () => {
    const zip = docx();
    const { bytes } = await limpiarOffice(
      await zip.generateAsync({ type: "uint8array", comment: "comentario de zip" }),
    );
    const limpio = await JSZip.loadAsync(bytes);
    expect((limpio as JSZip & { comment?: string | null }).comment ?? "").toBe("");
    const anios = new Set(Object.values(limpio.files).map((f) => f.date.getUTCFullYear()));
    expect(anios).toEqual(new Set([1980]));
  });

  it("reporta lo que había, leído del archivo", async () => {
    const { eliminados } = await limpiarOffice(await empacar(docx()));
    expect(eliminados).toEqual(
      expect.arrayContaining([
        "Autor",
        "Última persona que lo modificó",
        "Título",
        "Fecha de creación",
        "Fecha de modificación",
        "Empresa",
        "Responsable (Manager)",
        "Programa utilizado",
        "Tiempo de edición",
        "Propiedades personalizadas",
        "Miniatura",
        "Autores de comentarios o cambios",
        "Rutas de archivos en tu equipo",
      ]),
    );
  });

  it("no reporta lo que no estaba", async () => {
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<Types><Override PartName="/word/document.xml" ContentType="${MIME.docx}"/></Types>`,
    );
    zip.file(
      "_rels/.rels",
      `<Relationships><Relationship Id="r" Target="word/document.xml"/></Relationships>`,
    );
    zip.file("word/document.xml", `<w:document><w:t>Hola</w:t></w:document>`);
    const { eliminados } = await limpiarOffice(await empacar(zip));
    expect(eliminados).toEqual([]);
  });

  it("limpiar dos veces no encuentra nada más", async () => {
    const una = await limpiarOffice(await empacar(docx()));
    const dos = await limpiarOffice(una.bytes);
    expect(dos.eliminados).toEqual([]);
  });
});

describe("limpiarOffice: XLSX", () => {
  it("quita autores de comentarios, personas, usuario compartido y ruta local", async () => {
    const { bytes, eliminados } = await limpiarOffice(await empacar(xlsx()));
    const { todo, partes } = await xmlDe(bytes);
    for (const s of [AUTORA, "id-secreto", "maria", "absPath", "fileSharing"]) {
      expect(todo, s).not.toContain(s);
    }
    expect(partes["xl/comments1.xml"]).toContain("<author>Autor</author>");
    expect(partes["xl/comments1.xml"]).toContain("Comentario visible");
    expect(partes["xl/persons/person.xml"]).toContain('displayName="Autor"');
    expect(eliminados).toContain("Rutas de archivos en tu equipo");
    expect(eliminados).toContain("Autores de comentarios o cambios");
  });
});

describe("limpiarOffice: PPTX", () => {
  it("anonimiza a quienes comentan sin romper las referencias", async () => {
    const { bytes, eliminados } = await limpiarOffice(await empacar(pptx()));
    const { todo, partes } = await xmlDe(bytes);
    expect(todo).not.toContain(AUTORA);
    expect(partes["ppt/commentAuthors.xml"]).toContain('name="Autor"');
    expect(partes["ppt/commentAuthors.xml"]).toContain('id="0"');
    expect(partes["ppt/commentAuthors.xml"]).not.toContain('initials="AS"');
    expect(partes["ppt/comments/comment1.xml"]).not.toContain("2026");
    expect(eliminados).toContain("Autores de comentarios o cambios");
  });
});

describe("limpiarOffice: configuración de impresora y fuentes incrustadas", () => {
  const sinRastros = (todo: string) => {
    expect(todo).not.toMatch(/printerSettings\/|fonts\//);
    expect(todo).not.toMatch(
      /embedRegular|embedBold|embedTrueTypeFonts|saveSubsetFonts|embeddedFont/,
    );
    expect(todo).not.toContain(IMPRESORA);
  };

  it("los ejemplos son paquetes coherentes antes de limpiar", async () => {
    for (const ejemplo of [docxConImpresoraYFuentes, xlsxConImpresora, pptxConFuentes]) {
      expect(await problemasDeEstructura(await empacar(ejemplo()))).toEqual([]);
    }
  });

  it("DOCX: quita el binario de la impresora y las fuentes con sus referencias; el paquete queda coherente", async () => {
    const { bytes, eliminados } = await limpiarOffice(await empacar(docxConImpresoraYFuentes()));
    const { zip, partes, todo } = await xmlDe(bytes);
    expect(Object.keys(zip.files).filter((n) => /printerSettings\/|fonts\//.test(n))).toEqual([]);
    sinRastros(todo);
    expect(partes["word/document.xml"]).toContain("Texto de la denuncia");
    expect(partes["word/document.xml"]).toContain("<w:pgSz");
    expect(partes["word/fontTable.xml"]).toContain('w:name="Corporativa Sans"');
    expect(partes["word/fontTable.xml"]).toContain("<w:panose1");
    expect(partes["word/settings.xml"]).toContain("<w:zoom");
    expect(await problemasDeEstructura(bytes)).toEqual([]);
    expect(eliminados).toEqual(
      expect.arrayContaining(["Configuración de impresora", "Fuentes incrustadas"]),
    );
  });

  it("XLSX: pageSetup se conserva sin su r:id a la impresora", async () => {
    const { bytes, eliminados } = await limpiarOffice(await empacar(xlsxConImpresora()));
    const { partes, todo } = await xmlDe(bytes);
    sinRastros(todo);
    expect(partes["xl/worksheets/sheet1.xml"]).toContain('<pageSetup orientation="portrait"/>');
    expect(partes["xl/worksheets/sheet1.xml"]).toContain("<sheetData>");
    expect(await problemasDeEstructura(bytes)).toEqual([]);
    expect(eliminados).toContain("Configuración de impresora");
    expect(eliminados).not.toContain("Fuentes incrustadas");
  });

  it("PPTX: quita la lista de fuentes incrustadas y las banderas de la presentación", async () => {
    const { bytes, eliminados } = await limpiarOffice(await empacar(pptxConFuentes()));
    const { partes, todo } = await xmlDe(bytes);
    sinRastros(todo);
    expect(partes["ppt/presentation.xml"]).toContain('<p:sldId id="256" r:id="rId1"/>');
    expect(partes["ppt/presentation.xml"]).toMatch(/^<p:presentation xmlns:r="[^"]+"><p:sldIdLst>/);
    expect(await problemasDeEstructura(bytes)).toEqual([]);
    expect(eliminados).toEqual(
      expect.arrayContaining(["Configuración de impresora", "Fuentes incrustadas"]),
    );
  });

  it("la validación de estructura sí detecta referencias colgadas", async () => {
    const zip = docxConImpresoraYFuentes();
    zip.remove("word/printerSettings/printerSettings1.bin");
    zip.file("word/_rels/fontTable.xml.rels", `<Relationships ${RELS}/>`);
    const problemas = await problemasDeEstructura(await empacar(zip));
    expect(problemas.some((p) => p.includes("printerSettings1.bin"))).toBe(true);
    expect(problemas.some((p) => p.includes("fontTable.xml usa rId1"))).toBe(true);
  });
});

describe("limpiarOffice: partes que no se saben limpiar", () => {
  it.each(["image1.tiff", "image2.gif", "image3.bmp", "image4.emf", "image5.wmf"])(
    "rechaza una imagen %s en media/, que podría llevar ubicación",
    async (nombre) => {
      const zip = docx();
      zip.file(`word/media/${nombre}`, "II*\0 EXIF GPSLatitude Artist=Autora Secreta");
      await expect(limpiarOffice(await empacar(zip))).rejects.toThrow(/imagen/i);
    },
  );

  it("rechaza una imagen cuyo contenido no coincide con un formato que se limpie", async () => {
    const zip = docx();
    zip.file("word/media/disfraz.png", "II*\0 EXIF GPSLatitude");
    await expect(limpiarOffice(await empacar(zip))).rejects.toThrow(/imagen/i);
  });

  it.each(["Documento.docm", "Libro.xlsm", "Pres.pptm", "Plantilla.dotm", "anexo.pdf", "obj.bin"])(
    "rechaza un objeto incrustado %s que no reprocesa",
    async (nombre) => {
      const zip = docx();
      zip.file(`word/embeddings/${nombre}`, new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3]));
      await expect(limpiarOffice(await empacar(zip))).rejects.toThrow(/incrustado/i);
    },
  );

  it("limpia los documentos de Office incrustados", async () => {
    const zip = docx();
    zip.file("word/embeddings/Hoja.xlsx", await empacar(xlsx()));
    const { bytes, eliminados } = await limpiarOffice(await empacar(zip));
    const incrustado = await (
      await JSZip.loadAsync(bytes)
    )
      .file("word/embeddings/Hoja.xlsx")!
      .async("uint8array");
    const { todo, zip: interno } = await xmlDe(incrustado);
    expect(interno.file("docProps/core.xml")).toBeNull();
    expect(todo).not.toMatch(/Autora Secreta|absPath|maria/);
    expect(eliminados).toContain("Metadatos de documentos incrustados");
  });

  it("vacía también los vínculos externos que no son http(s) y conserva su Id", async () => {
    const zip = docx();
    zip.file(
      "word/_rels/document.xml.rels",
      `<Relationships><Relationship Id="rId7" Type="hyperlink" Target="mailto:maria@ejemplo.org" TargetMode="External"/><Relationship Id="rId8" Type="hyperlink" Target="\\\\servidor\\maria\\anexo.pdf" TargetMode="External"/><Relationship Id="rId9" Type="hyperlink" Target="https://ejemplo.org/" TargetMode="External"/></Relationships>`,
    );
    const { bytes } = await limpiarOffice(await empacar(zip));
    const { partes } = await xmlDe(bytes);
    const rels = partes["word/_rels/document.xml.rels"]!;
    expect(rels).not.toMatch(/maria|servidor|mailto/);
    expect(rels).toContain('Id="rId7"');
    expect(rels).toContain('Id="rId8"');
    expect(rels).toContain('Target="https://ejemplo.org/"');
  });

  it("rechaza en vez de aceptar si tras limpiar sobrevive una ruta local en un XML", async () => {
    const zip = docx();
    // Una parte poco habitual donde Office también puede dejar una ruta absoluta.
    zip.file(
      "word/webSettings.xml",
      `<w:webSettings><w:divs path="C:\\Users\\maria\\"/></w:webSettings>`,
    );
    await expect(limpiarOffice(await empacar(zip))).rejects.toThrow(ErrorLimpieza);
  });
});

describe("limpiarOffice: rechazos", () => {
  it("rechaza un ZIP que no es de Office", async () => {
    const zip = new JSZip();
    zip.file("nota.txt", "hola");
    await expect(limpiarOffice(await empacar(zip))).rejects.toThrow(ErrorLimpieza);
  });
  it("rechaza documentos con macros", async () => {
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<Types><Override PartName="/word/document.xml" ContentType="application/vnd.ms-word.document.macroEnabled.main+xml"/></Types>`,
    );
    await expect(limpiarOffice(await empacar(zip))).rejects.toThrow(/macros/);
  });
  it("rechaza bytes que no son un ZIP", async () => {
    await expect(limpiarOffice(new TextEncoder().encode("nada"))).rejects.toThrow(ErrorLimpieza);
  });
});
