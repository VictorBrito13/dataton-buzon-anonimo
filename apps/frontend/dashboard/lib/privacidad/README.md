# Privacidad en el cliente

Depurador de texto y limpieza de evidencias que corren en el navegador. Es el contexto "Privacidad en
el cliente" de [D10](../../../../../docs/decisiones-arquitectura.md).

**Esto reduce el riesgo; no garantiza el anonimato.** Avisa de lo que sabe reconocer y la persona
decide. Que no aparezca ningún aviso no significa que el texto sea seguro.

## Estructura

| Carpeta        | Contenido                                               | Depende de                                                              |
| -------------- | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| `index.ts`     | Fachada pública                                         | Todo lo demás                                                           |
| `dominio/`     | Reglas, contexto, solapes, alineación NER y limpiadores | Nada del navegador ni de la red; `pdf-lib` y `jszip` en los limpiadores |
| `adaptadores/` | Canvas, Worker y Transformers.js                        | Navegador                                                               |

Una prueba en `index.test.ts` falla si `dominio/` usa DOM, red o Transformers.js.

## API

- `escanearTexto(texto)`: hallazgos ordenados y sin solapes. Usa el modelo solo si ya se cargó.
- `limpiarArchivo(archivo)`: archivo limpio y lista de lo eliminado, o lanza `ErrorLimpieza` con un
  mensaje apto para la persona. Nunca devuelve el original como si estuviera limpio.
- `cargarModeloNer(alProgreso?)`: resuelve en `false` si no se pudo cargar; nunca lanza.
- `estadoModeloNer()`: `inactivo`, `cargando`, `listo` o `error`. Si el modelo falla, `escanearTexto`
  sigue con reglas sin avisar, así que la interfaz debe consultar este estado antes de decir que el
  modelo revisó el texto.
- `cancelarModeloNer()`: detiene la descarga o el análisis, termina el Worker y vuelve a `inactivo`.
  Lo que ya esté en la caché del navegador permanece.

## Qué detecta en el texto

| Capa        | Detecta                            | Cómo                                                                                                              |
| ----------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1, siempre  | CURP                               | Estructura, fecha real y clave de estado. No exige el dígito verificador: una CURP mal escrita también identifica |
| 1           | RFC de persona física y moral      | Estructura, fecha real y homoclave. Ignora los RFC genéricos del SAT                                              |
| 1           | Teléfonos mexicanos                | +52, 01, 044, 045, espacios, guiones, puntos y paréntesis. Ocho dígitos solo si se habla de un teléfono           |
| 1           | Correos                            | Forma                                                                                                             |
| 1           | CLABE                              | Dígito de control                                                                                                 |
| 1           | Tarjetas                           | Luhn y prefijo                                                                                                    |
| 1           | NSS                                | 11 dígitos con verificador. Sin confirmar con IMSS                                                                |
| 1           | Placas                             | Formas comunes; las ambiguas solo si aparece la palabra "placa"                                                   |
| 3, siempre  | Fechas exactas                     | Validadas contra el calendario                                                                                    |
| 3           | Unicidad y rol en primera persona  | Lista de expresiones                                                                                              |
| 2, opcional | Personas, lugares y organizaciones | Modelo NER local                                                                                                  |
| 2           | Cargos de terceros                 | Lista de cargos: el modelo no los reconoce. Se activa junto con el modelo                                         |

## Qué no detecta

- **Datos escritos de otra forma:** "cinco cinco, uno dos...", "juan arroba correo punto com", dígitos
  separados de forma inusual o con caracteres invisibles.
- **Nombres sin el modelo:** sin la capa 2 no se detecta ningún nombre.
- **Lo que identifica por contexto:** "la que lleva nómina en la oficina de Tula", horarios, anécdotas,
  forma de escribir. Las expresiones de la capa 3 son una lista corta y no entienden el sentido.
- **Otras identificaciones:** INE, pasaporte, cédula profesional, matrículas, números de empleado.
- **Teléfonos y placas de otros países**, y placas con formatos poco comunes.

También hay falsos positivos: un número de 11 dígitos que no sea NSS pasa el verificador una de cada
diez veces, y un código como `RTX-400-A` parece una placa. Los números precedidos por palabras como
"folio", "contrato" o "monto" se ignoran, así que un teléfono escrito justo después de "folio" tampoco
se marca.

## Capa 2: modelo

- **Modelo:** [`Xenova/distilbert-base-multilingual-cased-ner-hrl`](https://huggingface.co/Xenova/distilbert-base-multilingual-cased-ner-hrl),
  revisión `c2a4dbf`, cuantizado (`model_quantized.onnx`).
- **Peso:** 135 MB de modelo, 27 MB de WASM y 3 MB de tokenizador: unos 165 MB. Debe descargarse solo
  si la persona lo pide.
- **Licencia:** Academic Free License 3.0, declarada en el modelo base de Davlan. Es permisiva, permite
  distribuir junto a un proyecto CC BY-NC y exige conservar el aviso de atribución, que el script
  deja en `public/modelos/AVISO-MODELO.txt`. El repositorio de la conversión ONNX no declara licencia
  propia: se asume la del modelo base. No es una revisión legal. Tampoco se revisaron los términos de
  los corpus de entrenamiento (para español, CoNLL-2002).
- **Instalación:** `node scripts/descargar-modelo.mjs` en tiempo de build. Fija revisión y SHA-256, y
  copia el WASM de `node_modules`. No se versiona. Sin esos archivos, todo funciona con reglas.

**Precisión no medida.** Se entrenó con noticias en español de España y varios idiomas más; no se ha
evaluado con denuncias ni con nombres mexicanos. Puede omitir nombres, sobre todo en minúsculas, y
confundir otros. Textos muy densos en números pueden rebasar el límite del modelo en un fragmento; el
final de ese fragmento no se analiza.

**Rastro en el dispositivo.** Para funcionar sin conexión, el modelo queda en la caché del navegador.
Quien revise el equipo puede ver que este sitio guardó un modelo. No se borra al cerrar la pestaña.

## Qué limpia en los archivos

| Formato          | Se elimina si existe                                                                                                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| JPEG, PNG, WebP  | EXIF (GPS, cámara, serie, fechas, autor), XMP, IPTC, comentarios, miniaturas, perfil de color y datos tras el final de la imagen                                                                                                                                                           |
| PDF              | Propiedades, XMP, revisiones anteriores y objetos huérfanos, identificador del archivo, datos privados de la aplicación, autor y fecha de comentarios, adjuntos, firmas digitales y metadatos de fotos JPEG incrustadas                                                                    |
| DOCX, XLSX, PPTX | `docProps` (core, app, custom, miniatura), autores y fechas de comentarios y control de cambios, personas, `customXml`, identificadores de edición (rsid), rutas locales, revisiones de libros compartidos, fechas y comentario del ZIP, y metadatos de fotos JPEG, PNG y WebP incrustadas |
| Todos            | Nombre del archivo (queda `evidencia.<ext>`) y fecha de modificación                                                                                                                                                                                                                       |

Las imágenes siguen una lista de lo permitido: lo que no se reconoce, se quita. En el navegador se
re-codifican con canvas, ya rotadas. Si el canvas no existe, entrega un formato distinto o tiene la
lectura bloqueada (Tor Browser devuelve una imagen en blanco, lo que destruiría la evidencia), se usa
el limpiador de bytes, que no toca los píxeles y conserva solo la etiqueta de orientación. Las
animaciones también van por bytes, porque el canvas dejaría solo el primer cuadro.

Se rechazan con un mensaje claro: HEIC, AVIF, GIF, TIFF, Office antiguo, documentos con macros, PDF y
Office cifrados, y cualquier otro formato.

## Qué no limpia

- **El contenido visible:** caras, reflejos, gafetes, membretes, firmas, encabezados y nombres escritos.
- **Rastros en la propia imagen:** ruido del sensor de la cámara, marcas de agua invisibles y puntos de
  impresora. Re-codificar no los quita y el limpiador de bytes ni los toca.
- **Texto oculto en documentos:** lo borrado con control de cambios sigue en el DOCX (solo se anonimiza
  el autor), igual que hojas y filas ocultas, notas del orador y capas de PDF.
- **Dentro de documentos:** objetos incrustados (`word/embeddings`), imágenes EMF, TIFF o GIF, datos de
  formularios XFA, vínculos a internet y texto de campos que repita un nombre.
- **Lo que el servidor o la red pueden observar.** La segunda verificación del servidor (HU-20) es
  aparte, y esta librería no oculta la conexión de quien denuncia.

Efectos que debe conocer la autoridad: la re-codificación JPEG pierde algo de calidad y altera la huella
digital del archivo original, y sin perfil de color algunos tonos pueden cambiar. Un PDF firmado pierde
la firma. Las firmas y la huella original no se pueden conservar si se quiere quitar la identidad.

## Verificación

- `npm test -w @dataton/dashboard`: reglas, limpiadores de bytes, PDF, Office, cliente del Worker con
  uno simulado, ausencia de red y pureza del dominio.
- Comprobado una vez a mano en Chromium con `next build` y la CSP real: carga del modelo sin peticiones
  externas, análisis, uso sin conexión tras la primera carga, caída a reglas sin modelo y limpieza con
  canvas y con bytes de archivos hechos con Pillow. **Esto no forma parte de las pruebas automáticas.**
- `e2e/busqueda-modelo.spec.ts` cubre la capa 2 con el modelo real en la interfaz, si está instalado.
- Transformers.js abre una petición extra del `.onnx` para leer sus metadatos y no la cierra. En
  Chromium sin instrumentar se detuvo en 3 MB, sin descargarlo dos veces. Con Playwright sí se
  completa, porque su instrumentación lee los cuerpos: no sirve para medir el peso.
- **Sin comprobar:** Firefox, Safari, Tor Browser real y celulares (memoria y tiempo con un modelo de
  135 MB). Tampoco abrir los resultados en Word, Excel, PowerPoint o Acrobat. El XLSX se reabrió con
  `openpyxl`, y el PDF solo con `pdf-lib`. La prueba del canvas bloqueado usa un navegador simulado.
- Chromium ignora la orientación EXIF en WebP, tanto en el original como en el limpio: se ven igual. En
  ese caso el canvas no rota la imagen y el resultado ya no lleva la etiqueta.
