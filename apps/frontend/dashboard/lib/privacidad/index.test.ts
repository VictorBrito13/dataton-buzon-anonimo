import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MODELO_NER, ORT_MJS, ORT_WASM, RUTA_MODELOS } from "./dominio/archivos-modelo";
import {
  LATITUD_DE_PRUEBA,
  contiene,
  jpegConMetadatos,
  pngConMetadatos,
  webpConMetadatos,
} from "./dominio/limpieza/ejemplos";
import {
  ErrorLimpieza,
  cargarModeloNer,
  escanearTexto,
  estadoModeloNer,
  limpiarArchivo,
  type Hallazgo,
} from "./index";

// jsdom no implementa Blob.arrayBuffer, que sí existe en todos los navegadores actuales.
if (!Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function (this: Blob) {
    return new Promise((resolver, rechazar) => {
      const lector = new FileReader();
      lector.onload = () => resolver(lector.result as ArrayBuffer);
      lector.onerror = () => rechazar(lector.error);
      lector.readAsArrayBuffer(this);
    });
  };
}

const RELATO = `A quien corresponda: me llamo Rosa y trabajo como auxiliar en la Dirección de Obras. El 14 de marzo de 2026 vi cómo el director pidió alterar el contrato de la licitación LA-2025-0117 por $1,250,000.00 pesos. Fui quien capturó las facturas del año 2025, folio 2026031401, y soy la única que tiene acceso al sistema. Mi jefe directo me pidió depositar en la CLABE 032180000118359719 y me escribió desde jefe.obras@example.com. Su teléfono es (55) 1234-5678, su RFC GOMC850214AB3 y su CURP GOMC850214HDFNRR09. Llegó en una camioneta con placas ABC-123-A. Pagó con la tarjeta 4111 1111 1111 1111. Tiene el NSS 12345678903. El expediente 5512345678 se abrió entre 2024 y 2026 con 340 contratos y un monto total de 12500000 pesos.`;

const tiposYTextos = (hallazgos: Hallazgo[]) => hallazgos.map((h) => [h.tipo, h.texto]);

describe("escanearTexto", () => {
  it("encuentra lo esperado en un relato largo y realista", async () => {
    const hallazgos = await escanearTexto(RELATO);
    expect(tiposYTextos(hallazgos)).toEqual(
      expect.arrayContaining([
        ["cargo", "trabajo como auxiliar"],
        ["fecha_exacta", "El 14 de marzo de 2026"],
        ["descripcion_unica", "Fui quien"],
        ["descripcion_unica", "soy la única que"],
        ["descripcion_unica", "Mi jefe directo"],
        ["clabe", "032180000118359719"],
        ["correo", "jefe.obras@example.com"],
        ["telefono", "(55) 1234-5678"],
        ["rfc", "GOMC850214AB3"],
        ["curp", "GOMC850214HDFNRR09"],
        ["placa", "ABC-123-A"],
        ["tarjeta", "4111 1111 1111 1111"],
        ["nss", "12345678903"],
      ]),
    );
  });

  it("no confunde folios, montos, años ni licitaciones en ese relato", async () => {
    const textos = (await escanearTexto(RELATO)).map((h) => h.texto);
    for (const ruido of [
      "2026031401",
      "5512345678",
      "1,250,000.00",
      "12500000",
      "2025",
      "2024",
      "LA-2025-0117",
      "340",
    ]) {
      expect(
        textos.some((t) => t.includes(ruido)),
        ruido,
      ).toBe(false);
    }
  });

  it("sin modelo no reporta nombres ni crea el Worker", async () => {
    const worker = vi.fn();
    vi.stubGlobal("Worker", worker);
    const hallazgos = await escanearTexto("Hablé con Juan Pérez en Puebla");
    expect(hallazgos.filter((h) => h.tipo === "persona")).toEqual([]);
    expect(worker).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("los hallazgos no se solapan y sus posiciones son exactas", async () => {
    const hallazgos = await escanearTexto(RELATO);
    for (const [i, h] of hallazgos.entries()) {
      expect(RELATO.slice(h.inicio, h.fin)).toBe(h.texto);
      if (i > 0) expect(h.inicio).toBeGreaterThanOrEqual(hallazgos[i - 1].fin);
    }
  });
});

describe("cargarModeloNer", () => {
  it("si el navegador no puede cargarlo, resuelve en false y las reglas siguen", async () => {
    vi.stubGlobal("Worker", undefined);
    await expect(cargarModeloNer()).resolves.toBe(false);
    expect(estadoModeloNer()).toBe("error");
    const hallazgos = await escanearTexto("correo a@b.co");
    expect(hallazgos.map((h) => h.tipo)).toEqual(["correo"]);
    vi.unstubAllGlobals();
  });
});

describe("limpiarArchivo", () => {
  it("JPEG con GPS: antes lo tiene, después no", async () => {
    const original = jpegConMetadatos();
    expect(contiene(original, LATITUD_DE_PRUEBA)).toBe(true);
    const { archivo, eliminados } = await limpiarArchivo(
      new File([original.slice()], "IMG_rosa_lopez.jpg", { type: "image/jpeg" }),
    );
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    expect(contiene(bytes, LATITUD_DE_PRUEBA)).toBe(false);
    expect(eliminados).toContain("Ubicación GPS");
    expect(archivo.type).toBe("image/jpeg");
  });

  it("no conserva el nombre ni la fecha del archivo original", async () => {
    const { archivo, eliminados } = await limpiarArchivo(
      new File([jpegConMetadatos().slice()], "IMG_rosa_lopez.jpg", { lastModified: 1_700_000_000 }),
    );
    expect(archivo.name).toBe("evidencia.jpg");
    expect(archivo.lastModified).toBe(0);
    expect(eliminados).toEqual(
      expect.arrayContaining(["Nombre original del archivo", "Fecha de modificación del archivo"]),
    );
  });

  it("limpia PNG y WebP sin canvas", async () => {
    for (const [bytes, nombre, tipo] of [
      [pngConMetadatos(), "evidencia.png", "image/png"],
      [webpConMetadatos(), "evidencia.webp", "image/webp"],
    ] as const) {
      const { archivo, eliminados } = await limpiarArchivo(new File([bytes.slice()], "x"));
      expect(archivo.name).toBe(nombre);
      expect(archivo.type).toBe(tipo);
      expect(eliminados).toContain("Ubicación GPS");
    }
  });

  it("se guía por el contenido aunque el nombre mienta", async () => {
    const { archivo } = await limpiarArchivo(
      new File([pngConMetadatos().slice()], "foto.jpg", { type: "image/jpeg" }),
    );
    expect(archivo.type).toBe("image/png");
    expect(archivo.name).toBe("evidencia.png");
  });

  it("PDF con autor: antes lo tiene, después no", async () => {
    const doc = await PDFDocument.create();
    doc.setAuthor("Rosa");
    doc.addPage();
    const original = await doc.save({ useObjectStreams: false });
    const { archivo, eliminados } = await limpiarArchivo(
      new File([original.slice()], "denuncia_rosa.pdf"),
    );
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    expect(contiene(bytes, "/Author")).toBe(false);
    expect(eliminados).toContain("Autor");
    expect(archivo.name).toBe("evidencia.pdf");
    expect(archivo.type).toBe("application/pdf");
  });

  it.each([
    ["docx", "word/document.xml", "wordprocessingml.document.main", "wordprocessingml.document"],
    ["xlsx", "xl/workbook.xml", "spreadsheetml.sheet.main", "spreadsheetml.sheet"],
    [
      "pptx",
      "ppt/presentation.xml",
      "presentationml.presentation.main",
      "presentationml.presentation",
    ],
  ])("%s con autor: antes lo tiene, después no", async (ext, principal, tipoMain, mime) => {
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<Types><Override PartName="/${principal}" ContentType="application/vnd.openxmlformats-officedocument.${tipoMain}+xml"/><Override PartName="/docProps/core.xml" ContentType="x"/></Types>`,
    );
    zip.file(principal, "<raiz/>");
    zip.file("docProps/core.xml", "<c><dc:creator>Rosa Secreta</dc:creator></c>");
    const original = await zip.generateAsync({ type: "uint8array" });
    const { archivo, eliminados } = await limpiarArchivo(new File([original.slice()], `a.${ext}`));
    const limpio = await JSZip.loadAsync(new Uint8Array(await archivo.arrayBuffer()));
    expect(limpio.file("docProps/core.xml")).toBeNull();
    expect(eliminados).toContain("Autor");
    expect(archivo.name).toBe(`evidencia.${ext}`);
    expect(archivo.type).toBe(`application/vnd.openxmlformats-officedocument.${mime}`);
  });

  it("rechaza tipos no compatibles con un mensaje claro", async () => {
    const archivo = new File(["MZ ejecutable"], "programa.exe");
    await expect(limpiarArchivo(archivo)).rejects.toThrow(ErrorLimpieza);
    await expect(limpiarArchivo(archivo)).rejects.toThrow(/No podemos limpiar/);
  });

  it("un archivo que dice ser JPEG pero está dañado se rechaza", async () => {
    const dañado = new File([jpegConMetadatos().slice(0, 30)], "foto.jpg");
    await expect(limpiarArchivo(dañado)).rejects.toThrow(ErrorLimpieza);
  });

  it("cualquier fallo interno llega como ErrorLimpieza, no como otro error", async () => {
    const archivo = new File([""], "a.pdf");
    vi.spyOn(archivo, "arrayBuffer").mockRejectedValue(new TypeError("fallo interno"));
    await expect(limpiarArchivo(archivo)).rejects.toThrow(ErrorLimpieza);
  });
});

describe("sin red", () => {
  const prohibidas = {
    fetch: vi.fn(),
    XMLHttpRequest: vi.fn(),
    WebSocket: vi.fn(),
    EventSource: vi.fn(),
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", prohibidas.fetch);
    vi.stubGlobal("XMLHttpRequest", prohibidas.XMLHttpRequest);
    vi.stubGlobal("WebSocket", prohibidas.WebSocket);
    vi.stubGlobal("EventSource", prohibidas.EventSource);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("escanear y limpiar no intentan ninguna conexión", async () => {
    await escanearTexto(RELATO);
    await limpiarArchivo(new File([jpegConMetadatos().slice()], "a.jpg"));
    const doc = await PDFDocument.create();
    doc.addPage();
    await limpiarArchivo(new File([(await doc.save()).slice()], "a.pdf"));
    for (const [nombre, simulada] of Object.entries(prohibidas)) {
      expect(simulada, nombre).not.toHaveBeenCalled();
    }
  });
});

const archivosFuente = (carpeta: string): string[] =>
  readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) return archivosFuente(ruta);
    return /\.ts$/.test(nombre) && !nombre.endsWith(".test.ts") ? [ruta] : [];
  });

describe("arquitectura", () => {
  const raiz = join(process.cwd(), "lib/privacidad");

  it("el dominio no usa DOM, red, Worker ni Transformers.js", () => {
    const prohibido =
      /(?<![.\\\w-])(window|document|navigator|fetch|XMLHttpRequest|WebSocket|Worker|createImageBitmap|localStorage|HTMLCanvasElement)\b(?=[.(\s])|@huggingface\/transformers|adaptadores\//;
    for (const ruta of archivosFuente(join(raiz, "dominio"))) {
      const sinComentarios = readFileSync(ruta, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(prohibido.exec(sinComentarios)?.[0], ruta).toBeUndefined();
    }
  });

  it("ningún archivo apunta a un dominio externo", () => {
    for (const ruta of archivosFuente(raiz)) {
      const urls = readFileSync(ruta, "utf8").match(/https?:\/\/[^\s"'`)]+/g) ?? [];
      // ns.adobe.com es un identificador dentro de los archivos, no una dirección que se consulte.
      expect(
        urls.filter((u) => !u.startsWith("http://ns.adobe.com/")),
        ruta,
      ).toEqual([]);
    }
  });

  it("el Worker prohíbe modelos remotos y sirve el WASM desde el propio sitio", () => {
    const worker = readFileSync(join(raiz, "adaptadores/ner.worker.ts"), "utf8");
    expect(worker).toMatch(/allowRemoteModels\s*=\s*false/);
    expect(worker).toMatch(/localModelPath\s*=\s*"\/modelos\/"/);
    expect(worker).toMatch(/wasmPaths\s*=/);
    expect(worker).toMatch(/\/modelos\/ort\//);
  });

  it("la lista de archivos que se comprueba coincide con lo que pide el Worker", () => {
    const worker = readFileSync(join(raiz, "adaptadores/ner.worker.ts"), "utf8");
    expect(worker).toContain(`"${RUTA_MODELOS}"`);
    expect(worker).toContain(`"${MODELO_NER}"`);
    expect(worker).toContain(`${RUTA_MODELOS}${ORT_MJS}`);
    expect(worker).toContain(`${RUTA_MODELOS}${ORT_WASM}`);
  });
});
