/** Dónde publica el sitio la capa 2 (scripts/descargar-modelo.mjs) y qué le pide el navegador. */
export const MODELO_NER = "Xenova/distilbert-base-multilingual-cased-ner-hrl";
export const RUTA_MODELOS = "/modelos/";
export const ORT_MJS = "ort/ort-wasm-simd-threaded.asyncify.mjs";
export const ORT_WASM = "ort/ort-wasm-simd-threaded.asyncify.wasm";

/** Rutas relativas a RUTA_MODELOS. Sin cualquiera de ellas el modelo no puede cargar. */
export const ARCHIVOS_MODELO_NER: readonly string[] = [
  `${MODELO_NER}/config.json`,
  `${MODELO_NER}/tokenizer.json`,
  `${MODELO_NER}/tokenizer_config.json`,
  `${MODELO_NER}/onnx/model_quantized.onnx`,
  ORT_MJS,
  ORT_WASM,
];
