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
