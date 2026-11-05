import { ErrorLimpieza, type BytesLimpios } from "./errores";

/**
 * Limpieza de imágenes a nivel de bytes: sin canvas, sin red y sin tocar los
 * píxeles. Sigue una lista de lo permitido: lo que no se reconoce como necesario
 * para mostrar la imagen, se quita.
 */

export type FormatoImagen = "jpeg" | "png" | "webp";

const DANADA = "El archivo parece dañado y no se pudo limpiar. No se subió nada.";

const ascii = (bytes: Uint8Array, inicio: number, fin: number) =>
  String.fromCharCode(...bytes.subarray(inicio, fin));

const unir = (partes: Uint8Array[]) => {
  const salida = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const parte of partes) {
    salida.set(parte, i);
    i += parte.length;
  }
  return salida;
};

const sinRepetidos = (etiquetas: string[]) => [...new Set(etiquetas)];

const ETIQUETAS_IFD: Record<number, string> = {
  0x010e: "Descripción de la imagen",
  0x010f: "Marca de la cámara",
  0x0110: "Modelo de la cámara",
  0x0131: "Programa utilizado",
  0x0132: "Fecha y hora",
  0x013b: "Autor",
  0x8298: "Derechos de autor",
  0x9c9b: "Título",
  0x9c9c: "Comentario",
  0x9c9d: "Autor",
  0x9c9e: "Palabras clave",
  0x9c9f: "Asunto",
  0x9003: "Fecha y hora",
  0x9004: "Fecha y hora",
  0x9010: "Fecha y hora",
  0x9011: "Fecha y hora",
  0x9012: "Fecha y hora",
  0x9286: "Comentario",
  0x927c: "Datos internos del fabricante",
  0xa420: "Identificador único de la imagen",
  0xa430: "Nombre del propietario de la cámara",
  0xa431: "Número de serie de la cámara",
  0xa433: "Modelo de la lente",
  0xa434: "Modelo de la lente",
  0xa435: "Número de serie de la cámara",
};

/** Describen cómo está guardada la imagen: no dicen nada de quién la tomó. */
const ETIQUETAS_ESTRUCTURALES = new Set([
  0x0100, 0x0101, 0x0102, 0x0103, 0x0106, 0x0112, 0x0115, 0x011a, 0x011b, 0x0128, 0x0213, 0x8769,
  0x8825,
]);

const IFD_EXIF = 0x8769;
const IFD_GPS = 0x8825;
const ORIENTACION = 0x0112;

interface LecturaExif {
  etiquetas: string[];
  orientacion: number;
}

/** Lee un bloque TIFF sin confiar en él: cualquier posición fuera de rango termina la lectura. */
const leerExif = (tiff: Uint8Array): LecturaExif => {
  const lectura: LecturaExif = { etiquetas: [], orientacion: 1 };
  if (tiff.length < 8) return { ...lectura, etiquetas: ["Otros datos EXIF"] };
  const marca = ascii(tiff, 0, 2);
  if (marca !== "II" && marca !== "MM") return { ...lectura, etiquetas: ["Otros datos EXIF"] };
  const le = marca === "II";
  const vista = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const leerTabla = (inicio: number) => {
    if (inicio + 2 > tiff.length) return null;
    const total = vista.getUint16(inicio, le);
    if (inicio + 2 + total * 12 > tiff.length) return null;
    const entradas = Array.from({ length: total }, (_, i) => {
      const pos = inicio + 2 + i * 12;
      return {
        id: vista.getUint16(pos, le),
        tipo: vista.getUint16(pos + 2, le),
        valorCorto: vista.getUint16(pos + 8, le),
        valorLargo: vista.getUint32(pos + 8, le),
      };
    });
    const posSiguiente = inicio + 2 + total * 12;
    const siguiente = posSiguiente + 4 <= tiff.length ? vista.getUint32(posSiguiente, le) : 0;
    return { entradas, siguiente };
  };
  const anotar = (id: number) => {
    const nombre = ETIQUETAS_IFD[id];
    if (nombre) lectura.etiquetas.push(nombre);
    else if (!ETIQUETAS_ESTRUCTURALES.has(id)) lectura.etiquetas.push("Otros datos EXIF");
  };
  const cero = leerTabla(vista.getUint32(4, le));
  if (!cero) return { ...lectura, etiquetas: ["Otros datos EXIF"] };
  for (const entrada of cero.entradas) {
    anotar(entrada.id);
    if (entrada.id === ORIENTACION) {
      const valor = entrada.tipo === 3 ? entrada.valorCorto : entrada.valorLargo;
      if (valor >= 1 && valor <= 8) lectura.orientacion = valor;
    }
    if (entrada.id === IFD_EXIF) {
      for (const interna of leerTabla(entrada.valorLargo)?.entradas ?? []) anotar(interna.id);
    }
    if (entrada.id === IFD_GPS && (leerTabla(entrada.valorLargo)?.entradas.length ?? 1) > 0) {
      lectura.etiquetas.push("Ubicación GPS");
    }
  }
  if (cero.siguiente !== 0) lectura.etiquetas.push("Miniatura");
  return lectura;
};

/** TIFF mínimo con solo la orientación. */
const tiffDeOrientacion = (orientacion: number) =>
  Uint8Array.of(
    0x49, 0x49, 0x2a, 0x00, 8, 0, 0, 0,
    1, 0,
    0x12, 0x01, 3, 0, 1, 0, 0, 0, orientacion, 0, 0, 0,
    0, 0, 0, 0,
  ); // prettier-ignore

const FIRMA_EXIF = "Exif\0\0";
const FIRMA_XMP = "http://ns.adobe.com/xap/1.0/\0";

interface SegmentoJpeg {
  marca: number;
  inicio: number;
  fin: number;
  /** Solo los que llevan longitud; apunta al inicio de los datos. */
  datos: number;
}

const leerSegmentosJpeg = (bytes: Uint8Array) => {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new ErrorLimpieza("El archivo no es un JPEG válido.");
  }
  const segmentos: SegmentoJpeg[] = [];
  let i = 2;
  let vioImagen = false;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) throw new ErrorLimpieza(DANADA);
    while (i < bytes.length && bytes[i] === 0xff) i++;
    const marca = bytes[i];
    const inicio = i - 1;
    i++;
    if (marca === 0xd9) {
      return { segmentos, fin: i, vioImagen };
    }
    if (marca === undefined || (marca >= 0xd0 && marca <= 0xd7) || marca === 0x01) {
      if (marca === undefined) throw new ErrorLimpieza(DANADA);
      segmentos.push({ marca, inicio, fin: i, datos: i });
      continue;
    }
    if (i + 2 > bytes.length) throw new ErrorLimpieza(DANADA);
    const longitud = (bytes[i] << 8) | bytes[i + 1];
    if (longitud < 2 || i + longitud > bytes.length) throw new ErrorLimpieza(DANADA);
    const datos = i + 2;
    i += longitud;
    if (marca === 0xda) {
      vioImagen = true;
      // Datos de la imagen: terminan en el primer marcador que no sea relleno ni reinicio.
      while (i < bytes.length) {
        if (bytes[i] === 0xff && i + 1 < bytes.length) {
          const sig = bytes[i + 1];
          if (sig !== 0x00 && !(sig >= 0xd0 && sig <= 0xd7)) break;
          i += 2;
        } else {
          i++;
        }
      }
    }
    segmentos.push({ marca, inicio, fin: i, datos });
  }
  // Imagen sin marcador final: se conserva lo leído, ya no hay nada después.
  return { segmentos, fin: bytes.length, vioImagen };
};

const empiezaCon = (bytes: Uint8Array, inicio: number, firma: string) =>
  inicio + firma.length <= bytes.length && ascii(bytes, inicio, inicio + firma.length) === firma;

const exifDeSegmento = (bytes: Uint8Array, s: SegmentoJpeg) =>
  s.marca === 0xe1 && empiezaCon(bytes, s.datos, FIRMA_EXIF)
    ? bytes.subarray(s.datos + FIRMA_EXIF.length, s.fin)
    : null;

const etiquetaDeSegmento = (bytes: Uint8Array, s: SegmentoJpeg): string[] => {
  if (s.marca === 0xe1) {
    if (empiezaCon(bytes, s.datos, FIRMA_XMP)) return ["Datos XMP"];
    if (empiezaCon(bytes, s.datos, "http://ns.adobe.com/xmp/extension/")) return ["Datos XMP"];
    return ["Otros datos incrustados"];
  }
  if (s.marca === 0xed) return ["Datos IPTC"];
  if (s.marca === 0xe2) {
    if (empiezaCon(bytes, s.datos, "ICC_PROFILE")) return ["Perfil de color"];
    if (empiezaCon(bytes, s.datos, "MPF")) return ["Imágenes adicionales incrustadas"];
    return ["Otros datos incrustados"];
  }
  if (s.marca === 0xfe) return ["Comentario"];
  return ["Otros datos incrustados"];
};

const esMarcadorDeImagen = (marca: number) =>
  // SOF, DHT, DAC, DQT, DNL, DRI, DHP, EXP, SOS y reinicios: sin ellos no hay imagen.
  (marca >= 0xc0 && marca <= 0xcf) ||
  (marca >= 0xd0 && marca <= 0xd7) ||
  (marca >= 0xda && marca <= 0xdf);

export const limpiarJpeg = (bytes: Uint8Array): BytesLimpios => {
  const { segmentos, fin, vioImagen } = leerSegmentosJpeg(bytes);
  if (!vioImagen) throw new ErrorLimpieza(DANADA);
  const eliminados: string[] = [];
  const conservados: Uint8Array[] = [];
  let orientacion = 1;
  let jfif: Uint8Array | null = null;

  for (const s of segmentos) {
    const crudo = bytes.subarray(s.inicio, s.fin);
    if (esMarcadorDeImagen(s.marca)) {
      conservados.push(crudo);
    } else if (s.marca === 0xe0 && empiezaCon(bytes, s.datos, "JFIF\0") && s.fin - s.datos >= 14) {
      // Se conservan versión y densidad; la miniatura, si la hay, se va.
      const tieneMiniatura = s.fin - s.datos > 14;
      if (tieneMiniatura) eliminados.push("Miniatura");
      const nuevo = crudo.slice(0, 18);
      nuevo[2] = 0;
      nuevo[3] = 16;
      nuevo[16] = 0;
      nuevo[17] = 0;
      if (jfif === null) jfif = nuevo;
    } else if (s.marca === 0xe0) {
      eliminados.push("Miniatura");
    } else if (s.marca === 0xee && empiezaCon(bytes, s.datos, "Adobe")) {
      // Solo trae banderas de color, y sin ellas algunos JPEG se verían mal.
      conservados.push(crudo);
    } else {
      const tiff = exifDeSegmento(bytes, s);
      if (tiff) {
        const exif = leerExif(tiff);
        eliminados.push(...exif.etiquetas);
        orientacion = exif.orientacion;
      } else {
        eliminados.push(...etiquetaDeSegmento(bytes, s));
      }
    }
  }
  if (fin < bytes.length) eliminados.push("Datos ocultos al final del archivo");

  const partes: Uint8Array[] = [Uint8Array.of(0xff, 0xd8)];
  if (jfif) partes.push(jfif);
  if (orientacion !== 1) {
    const tiff = tiffDeOrientacion(orientacion);
    const firma = new TextEncoder().encode(FIRMA_EXIF);
    const largo = 2 + firma.length + tiff.length;
    partes.push(Uint8Array.of(0xff, 0xe1, largo >> 8, largo & 0xff), firma, tiff);
  }
  partes.push(...conservados);
  // Solo si el archivo original lo tenía: no se inventa un final para uno truncado.
  if (fin > 2 && bytes[fin - 2] === 0xff && bytes[fin - 1] === 0xd9) {
    partes.push(Uint8Array.of(0xff, 0xd9));
  }
  return { bytes: unir(partes), eliminados: sinRepetidos(eliminados) };
};

const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CHUNKS_PNG_PERMITIDOS = new Set(
  "IHDR PLTE IDAT IEND tRNS gAMA cHRM sRGB sBIT bKGD pHYs acTL fcTL fdAT cICP".split(" "),
);

const TEXTOS_PNG: Record<string, string> = {
  Author: "Autor",
  Title: "Título",
  Description: "Descripción de la imagen",
  Copyright: "Derechos de autor",
  "Creation Time": "Fecha y hora",
  Software: "Programa utilizado",
  Source: "Marca de la cámara",
  Comment: "Comentario",
  "XML:com.adobe.xmp": "Datos XMP",
};

const tablaCrc = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (bytes: Uint8Array) => {
  let c = 0xffffffff;
  for (const b of bytes) c = tablaCrc[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

interface ChunkPng {
  tipo: string;
  inicio: number;
  datos: number;
  fin: number;
  longitud: number;
}

const leerChunksPng = (bytes: Uint8Array) => {
  if (bytes.length < 8 || FIRMA_PNG.some((b, i) => bytes[i] !== b)) {
    throw new ErrorLimpieza("El archivo no es un PNG válido.");
  }
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: ChunkPng[] = [];
  let i = 8;
  while (i < bytes.length) {
    if (i + 12 > bytes.length) throw new ErrorLimpieza(DANADA);
    const longitud = vista.getUint32(i);
    const fin = i + 12 + longitud;
    if (fin > bytes.length) throw new ErrorLimpieza(DANADA);
    const tipo = ascii(bytes, i + 4, i + 8);
    chunks.push({ tipo, inicio: i, datos: i + 8, fin, longitud });
    i = fin;
    if (tipo === "IEND") return { chunks, fin: i };
  }
  throw new ErrorLimpieza(DANADA);
};

const chunkPng = (tipo: string, datos: Uint8Array) => {
  const cuerpo = unir([new TextEncoder().encode(tipo), datos]);
  const salida = new Uint8Array(cuerpo.length + 8);
  const vista = new DataView(salida.buffer);
  vista.setUint32(0, datos.length);
  salida.set(cuerpo, 4);
  vista.setUint32(4 + cuerpo.length, crc32(cuerpo));
  return salida;
};

export const limpiarPng = (bytes: Uint8Array): BytesLimpios => {
  const { chunks, fin } = leerChunksPng(bytes);
  if (chunks[0]?.tipo !== "IHDR") throw new ErrorLimpieza(DANADA);
  const eliminados: string[] = [];
  let orientacion = 1;
  const conservados: ChunkPng[] = [];

  for (const c of chunks) {
    if (CHUNKS_PNG_PERMITIDOS.has(c.tipo)) {
      conservados.push(c);
    } else if (c.tipo === "eXIf") {
      const exif = leerExif(bytes.subarray(c.datos, c.datos + c.longitud));
      eliminados.push(...exif.etiquetas);
      orientacion = exif.orientacion;
    } else if (c.tipo === "tEXt" || c.tipo === "zTXt" || c.tipo === "iTXt") {
      const datos = bytes.subarray(c.datos, c.datos + c.longitud);
      const corte = datos.indexOf(0);
      const clave = ascii(datos, 0, corte < 0 ? datos.length : corte);
      eliminados.push(TEXTOS_PNG[clave] ?? "Texto incrustado");
    } else if (c.tipo === "tIME") {
      eliminados.push("Fecha de modificación de la imagen");
    } else if (c.tipo === "iCCP") {
      eliminados.push("Perfil de color");
    } else {
      eliminados.push("Otros datos incrustados");
    }
  }
  if (fin < bytes.length) eliminados.push("Datos ocultos al final del archivo");

  const partes: Uint8Array[] = [bytes.subarray(0, 8)];
  for (const [i, c] of conservados.entries()) {
    partes.push(bytes.subarray(c.inicio, c.fin));
    if (i === 0 && orientacion !== 1) partes.push(chunkPng("eXIf", tiffDeOrientacion(orientacion)));
  }
  return { bytes: unir(partes), eliminados: sinRepetidos(eliminados) };
};

const BANDERA_ICC = 0x20;
const BANDERA_EXIF = 0x08;
const BANDERA_XMP = 0x04;
const BANDERA_ANIMACION = 0x02;
const CHUNKS_WEBP_PERMITIDOS = new Set(["VP8X", "VP8 ", "VP8L", "ALPH", "ANIM", "ANMF"]);

interface ChunkRiff {
  tipo: string;
  datos: number;
  longitud: number;
  fin: number;
}

const leerChunksWebp = (bytes: Uint8Array) => {
  if (bytes.length < 12 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 12) !== "WEBP") {
    throw new ErrorLimpieza("El archivo no es un WebP válido.");
  }
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const finRiff = 8 + vista.getUint32(4, true);
  if (finRiff > bytes.length) throw new ErrorLimpieza(DANADA);
  const chunks: ChunkRiff[] = [];
  let i = 12;
  while (i < finRiff) {
    if (i + 8 > finRiff) throw new ErrorLimpieza(DANADA);
    const longitud = vista.getUint32(i + 4, true);
    const datos = i + 8;
    if (datos + longitud > finRiff) throw new ErrorLimpieza(DANADA);
    const fin = Math.min(datos + longitud + (longitud % 2), finRiff);
    chunks.push({ tipo: ascii(bytes, i, i + 4), datos, longitud, fin });
    i = fin;
  }
  return { chunks, finRiff };
};

const chunkRiff = (tipo: string, datos: Uint8Array) => {
  const relleno = datos.length % 2;
  const salida = new Uint8Array(8 + datos.length + relleno);
  salida.set(new TextEncoder().encode(tipo));
  new DataView(salida.buffer).setUint32(4, datos.length, true);
  salida.set(datos, 8);
  return salida;
};

export const limpiarWebp = (bytes: Uint8Array): BytesLimpios => {
  const { chunks, finRiff } = leerChunksWebp(bytes);
  const eliminados: string[] = [];
  let orientacion = 1;
  const conservados: ChunkRiff[] = [];

  for (const c of chunks) {
    if (CHUNKS_WEBP_PERMITIDOS.has(c.tipo)) {
      conservados.push(c);
    } else if (c.tipo === "EXIF") {
      const crudo = bytes.subarray(c.datos, c.datos + c.longitud);
      const inicioTiff = empiezaCon(crudo, 0, FIRMA_EXIF) ? FIRMA_EXIF.length : 0;
      const exif = leerExif(crudo.subarray(inicioTiff));
      eliminados.push(...exif.etiquetas);
      orientacion = exif.orientacion;
    } else if (c.tipo === "XMP ") {
      eliminados.push("Datos XMP");
    } else if (c.tipo === "ICCP") {
      eliminados.push("Perfil de color");
    } else {
      eliminados.push("Otros datos incrustados");
    }
  }
  if (finRiff < bytes.length) eliminados.push("Datos ocultos al final del archivo");

  const partes: Uint8Array[] = [];
  for (const c of conservados) {
    const datos = bytes.slice(c.datos, c.datos + c.longitud);
    if (c.tipo === "VP8X" && datos.length > 0) {
      datos[0] &= ~(BANDERA_ICC | BANDERA_EXIF | BANDERA_XMP);
      if (orientacion !== 1) datos[0] |= BANDERA_EXIF;
    }
    partes.push(chunkRiff(c.tipo, datos));
  }
  // EXIF solo es válido con VP8X, y su lugar es después de los datos de la imagen.
  const hayVp8x = conservados.some((c) => c.tipo === "VP8X");
  if (hayVp8x && orientacion !== 1) partes.push(chunkRiff("EXIF", tiffDeOrientacion(orientacion)));

  const cuerpo = unir(partes);
  const salida = new Uint8Array(12 + cuerpo.length);
  salida.set(new TextEncoder().encode("RIFF"));
  new DataView(salida.buffer).setUint32(4, cuerpo.length + 4, true);
  salida.set(new TextEncoder().encode("WEBP"), 8);
  salida.set(cuerpo, 12);
  return { bytes: salida, eliminados: sinRepetidos(eliminados) };
};

export const limpiarImagen = (bytes: Uint8Array, formato: FormatoImagen): BytesLimpios => {
  if (formato === "jpeg") return limpiarJpeg(bytes);
  if (formato === "png") return limpiarPng(bytes);
  return limpiarWebp(bytes);
};

/** Orientación que indican los metadatos del archivo (1 = normal). */
export const leerOrientacion = (bytes: Uint8Array, formato: FormatoImagen): number => {
  if (formato === "jpeg") {
    for (const s of leerSegmentosJpeg(bytes).segmentos) {
      const tiff = exifDeSegmento(bytes, s);
      if (tiff) return leerExif(tiff).orientacion;
    }
    return 1;
  }
  if (formato === "png") {
    const chunk = leerChunksPng(bytes).chunks.find((c) => c.tipo === "eXIf");
    return chunk
      ? leerExif(bytes.subarray(chunk.datos, chunk.datos + chunk.longitud)).orientacion
      : 1;
  }
  const chunk = leerChunksWebp(bytes).chunks.find((c) => c.tipo === "EXIF");
  if (!chunk) return 1;
  const crudo = bytes.subarray(chunk.datos, chunk.datos + chunk.longitud);
  return leerExif(crudo.subarray(empiezaCon(crudo, 0, FIRMA_EXIF) ? FIRMA_EXIF.length : 0))
    .orientacion;
};

/** Pasar una animación por canvas dejaría solo el primer cuadro. */
export const esAnimada = (bytes: Uint8Array, formato: FormatoImagen): boolean => {
  if (formato === "png") return leerChunksPng(bytes).chunks.some((c) => c.tipo === "acTL");
  if (formato === "webp") {
    return leerChunksWebp(bytes).chunks.some(
      (c) => c.tipo === "ANIM" || (c.tipo === "VP8X" && (bytes[c.datos] & BANDERA_ANIMACION) !== 0),
    );
  }
  return false;
};
