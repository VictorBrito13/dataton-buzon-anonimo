#!/usr/bin/env node
/**
 * Prepara en public/modelos la capa opcional de NER. Se corre una vez, en tiempo
 * de build: `node scripts/descargar-modelo.mjs`. En ejecución el navegador solo
 * pide estos archivos al propio sitio (la CSP prohíbe cualquier otro origen).
 *
 * La revisión y los SHA-256 están fijos: si el contenido publicado cambia, falla.
 * Si no hay red se puede omitir: el sitio funciona igual con la capa de reglas.
 */
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { copyFile, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const MODELO = "Xenova/distilbert-base-multilingual-cased-ner-hrl";
const REVISION = "c2a4dbf593c57f47004c5bc2d3770d311aee9c43";

const ARCHIVOS = [
  {
    ruta: "config.json",
    sha256: "38847be4dc6699b1218a749ed69f888c2ccc7b4deba98e3c4a1cac8cb34d54c8",
  },
  {
    ruta: "tokenizer.json",
    sha256: "bf1b59b7b11c95f194f51708d918eea378e09d05f84c0e1656dc5180e8117088",
  },
  {
    ruta: "tokenizer_config.json",
    sha256: "2d61ce6c7646881e0e7ef08e3b5dd655a19553ab85c41b1a3c27090a63ff6f49",
  },
  {
    ruta: "special_tokens_map.json",
    sha256: "b6d346be366a7d1d48332dbc9fdf3bf8960b5d879522b7799ddba59e76237ee3",
  },
  {
    ruta: "onnx/model_quantized.onnx",
    sha256: "24a0b98f4dd4cd92842f5a541272f86f760225a64a29928eddef14bdb2edb986",
  },
];

/** Las mismas variantes que Transformers.js pide por omisión para WASM. */
const ARCHIVOS_ORT = [
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
];

const AVISO = `Modelo: ${MODELO} (revisión ${REVISION})
Conversión a ONNX de Davlan/distilbert-base-multilingual-cased-ner-hrl,
de David Adelani, publicado bajo la Academic Free License 3.0 (AFL-3.0).
Se distribuye sin modificar el modelo, conservando este aviso.
`;

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const destino = join(raiz, "public", "modelos");

const sha256 = async (ruta) => {
  const hash = createHash("sha256");
  await pipeline(createReadStream(ruta), hash);
  return hash.digest("hex");
};

const descargar = async ({ ruta, sha256: esperado }) => {
  const final = join(destino, MODELO, ruta);
  if (existsSync(final) && (await sha256(final)) === esperado) {
    console.log(`ya estaba: ${ruta}`);
    return;
  }
  await mkdir(dirname(final), { recursive: true });
  const url = `https://huggingface.co/${MODELO}/resolve/${REVISION}/${ruta}`;
  const respuesta = await fetch(url);
  if (!respuesta.ok || !respuesta.body) {
    throw new Error(`No se pudo descargar ${ruta}: HTTP ${respuesta.status}`);
  }
  const temporal = `${final}.parcial`;
  await pipeline(Readable.fromWeb(respuesta.body), createWriteStream(temporal));
  const obtenido = await sha256(temporal);
  if (obtenido !== esperado) {
    await rm(temporal);
    throw new Error(`Huella inesperada en ${ruta}: ${obtenido}`);
  }
  await rename(temporal, final);
  console.log(`descargado: ${ruta}`);
};

/** El WASM no se descarga: sale de la versión exacta instalada en node_modules. */
const copiarOnnxRuntime = async () => {
  // Se resuelve desde Transformers.js para copiar la versión que esa librería va a usar.
  const require = createRequire(join(raiz, "package.json"));
  const requireDeTransformers = createRequire(require.resolve("@huggingface/transformers"));
  const dist = dirname(requireDeTransformers.resolve("onnxruntime-web"));
  await mkdir(join(destino, "ort"), { recursive: true });
  for (const archivo of ARCHIVOS_ORT) {
    await copyFile(join(dist, archivo), join(destino, "ort", archivo));
    console.log(`copiado: ort/${archivo}`);
  }
};

for (const archivo of ARCHIVOS) await descargar(archivo);
await copiarOnnxRuntime();
await writeFile(join(destino, "AVISO-MODELO.txt"), AVISO);
console.log(`Listo en ${destino}`);
