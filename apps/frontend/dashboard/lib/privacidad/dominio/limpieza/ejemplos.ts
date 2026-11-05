/**
 * Construye archivos de ejemplo byte a byte para las pruebas: así se sabe con
 * exactitud qué metadatos traen, sin depender de archivos binarios en el repositorio.
 */

const texto = (s: string) => new TextEncoder().encode(s);

export const unir = (...partes: Uint8Array[]): Uint8Array => {
  const total = partes.reduce((n, p) => n + p.length, 0);
  const salida = new Uint8Array(total);
  let i = 0;
  for (const parte of partes) {
    salida.set(parte, i);
    i += parte.length;
  }
  return salida;
};

export const contiene = (bytes: Uint8Array, buscado: string | Uint8Array): boolean => {
  const aguja = typeof buscado === "string" ? texto(buscado) : buscado;
  afuera: for (let i = 0; i <= bytes.length - aguja.length; i++) {
    for (let j = 0; j < aguja.length; j++) if (bytes[i + j] !== aguja[j]) continue afuera;
    return true;
  }
  return false;
};

const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];

interface Etiqueta {
  id: number;
  /** Texto (tipo ASCII) o número corto (tipo SHORT). */
  valor: string | number;
}

/** Tabla TIFF en little-endian. Los textos se guardan tras todas las entradas. */
const ifd = (etiquetas: Etiqueta[], posicion: number, siguiente = 0): number[] => {
  const tablaFin = posicion + 2 + etiquetas.length * 12 + 4;
  const salida: number[] = [...u16(etiquetas.length)];
  const extra: number[] = [];
  for (const { id, valor } of etiquetas) {
    if (typeof valor === "number") {
      salida.push(...u16(id), ...u16(3), ...u32(1), ...u16(valor), 0, 0);
    } else {
      const ascii = [...texto(valor), 0];
      salida.push(...u16(id), ...u16(2), ...u32(ascii.length));
      if (ascii.length <= 4) {
        salida.push(...ascii, ...new Array(4 - ascii.length).fill(0));
      } else {
        salida.push(...u32(tablaFin + extra.length));
        extra.push(...ascii);
      }
    }
  }
  salida.push(...u32(siguiente), ...extra);
  return salida;
};

export const LATITUD_DE_PRUEBA = "19deg25m42sN";
export const MARCA_DE_PRUEBA = "CamaraDePrueba";
export const AUTOR_EXIF_DE_PRUEBA = "Maria Fotografa";
export const SERIE_DE_PRUEBA = "SERIE-998877";

/** Bloque TIFF con cámara, autor, fecha, GPS, número de serie y orientación. */
export const tiffCompleto = (orientacion = 6): Uint8Array => {
  // IFD0 en 8, con 7 entradas; los apuntadores a Exif y GPS se resuelven con posiciones fijas.
  const posExif = 200;
  const posGps = 300;
  const cero = ifd(
    [
      { id: 0x010f, valor: MARCA_DE_PRUEBA },
      { id: 0x0112, valor: orientacion },
      { id: 0x0131, valor: "EditorDePrueba 1.0" },
      { id: 0x0132, valor: "2026:03:14 10:15:00" },
      { id: 0x013b, valor: AUTOR_EXIF_DE_PRUEBA },
    ],
    8,
  );
  // Apuntadores LONG agregados a mano para no complicar el constructor.
  const apuntador = (id: number, destino: number) => [
    ...u16(id),
    ...u16(4),
    ...u32(1),
    ...u32(destino),
  ];
  const tablaCero = [
    ...u16(7),
    ...cero.slice(2, 2 + 5 * 12),
    ...apuntador(0x8769, posExif),
    ...apuntador(0x8825, posGps),
    ...u32(0),
  ];
  // Las posiciones de los textos cambian al insertar dos entradas: se recorren 24 bytes.
  const textosCero = cero.slice(2 + 5 * 12 + 4);
  for (let e = 0; e < 5; e++) {
    const base = 2 + e * 12;
    const longitud = tablaCero[base + 4] | (tablaCero[base + 5] << 8);
    const tipo = tablaCero[base + 2];
    if (tipo === 2 && longitud > 4) {
      const pos =
        tablaCero[base + 8] |
        (tablaCero[base + 9] << 8) |
        (tablaCero[base + 10] << 16) |
        (tablaCero[base + 11] << 24);
      tablaCero.splice(base + 8, 4, ...u32(pos + 24));
    }
  }
  const salida = new Array<number>(420).fill(0);
  salida.splice(0, 8, 0x49, 0x49, 0x2a, 0x00, ...u32(8));
  const coloca = (pos: number, datos: number[]) => salida.splice(pos, datos.length, ...datos);
  coloca(8, [...tablaCero, ...textosCero]);
  coloca(posExif, ifd([{ id: 0xa431, valor: SERIE_DE_PRUEBA }], posExif));
  coloca(posGps, ifd([{ id: 0x0002, valor: LATITUD_DE_PRUEBA }], posGps));
  return Uint8Array.from(salida);
};

const segmentoJpeg = (marca: number, datos: Uint8Array) =>
  unir(
    Uint8Array.of(0xff, marca, ((datos.length + 2) >> 8) & 0xff, (datos.length + 2) & 0xff),
    datos,
  );

export const ENTROPIA_DE_PRUEBA = Uint8Array.of(0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56);

/** Segmentos necesarios para que el archivo siga siendo una imagen. */
const nucleoJpeg = () =>
  unir(
    segmentoJpeg(0xdb, new Uint8Array(65).fill(1)),
    segmentoJpeg(0xc0, Uint8Array.of(8, 0, 1, 0, 1, 1, 1, 0x11, 0)),
    segmentoJpeg(0xc4, new Uint8Array(20).fill(0)),
    segmentoJpeg(0xda, Uint8Array.of(1, 1, 0, 0, 63, 0)),
    ENTROPIA_DE_PRUEBA,
    Uint8Array.of(0xff, 0xd9),
  );

export const jpegSinMetadatos = () => unir(Uint8Array.of(0xff, 0xd8), nucleoJpeg());

export const XMP_DE_PRUEBA = "<x:xmpmeta>Autora XMP Secreta</x:xmpmeta>";

/** JPEG con EXIF (GPS incluido), XMP, IPTC, comentario, ICC y datos tras el final. */
export const jpegConMetadatos = (orientacion = 6): Uint8Array =>
  unir(
    Uint8Array.of(0xff, 0xd8),
    segmentoJpeg(0xe0, Uint8Array.of(0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 72, 0, 72, 0, 0)),
    segmentoJpeg(0xe1, unir(texto("Exif\0\0"), tiffCompleto(orientacion))),
    segmentoJpeg(0xe1, unir(texto("http://ns.adobe.com/xap/1.0/\0"), texto(XMP_DE_PRUEBA))),
    segmentoJpeg(0xed, texto("Photoshop 3.0\0Fuente IPTC Secreta")),
    segmentoJpeg(0xe2, texto("ICC_PROFILE\0\x01\x01perfil")),
    segmentoJpeg(0xfe, texto("Comentario Secreto")),
    nucleoJpeg(),
    texto("VIDEO OCULTO AL FINAL"),
  );

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

const be32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];

export const chunkPng = (tipo: string, datos: Uint8Array) => {
  const cuerpo = unir(texto(tipo), datos);
  return unir(Uint8Array.from(be32(datos.length)), cuerpo, Uint8Array.from(be32(crc32(cuerpo))));
};

export const FIRMA_PNG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const IHDR = Uint8Array.of(0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0);
export const IDAT_DE_PRUEBA = Uint8Array.of(0x78, 0x9c, 0x62, 0x00, 0x01, 0x02, 0x03);

export const pngSinMetadatos = () =>
  unir(
    FIRMA_PNG,
    chunkPng("IHDR", IHDR),
    chunkPng("IDAT", IDAT_DE_PRUEBA),
    chunkPng("IEND", new Uint8Array()),
  );

export const pngConMetadatos = (orientacion = 6) =>
  unir(
    FIRMA_PNG,
    chunkPng("IHDR", IHDR),
    chunkPng("eXIf", tiffCompleto(orientacion)),
    chunkPng("tEXt", texto("Author\0Autora PNG Secreta")),
    chunkPng("tEXt", texto("Software\0EditorPNG")),
    chunkPng("iTXt", texto(`XML:com.adobe.xmp\0\0\0\0\0${XMP_DE_PRUEBA}`)),
    chunkPng("tIME", Uint8Array.of(7, 234, 3, 14, 10, 15, 0)),
    chunkPng("IDAT", IDAT_DE_PRUEBA),
    chunkPng("IEND", new Uint8Array()),
    texto("DATOS OCULTOS"),
  );

const chunkRiff = (tipo: string, datos: Uint8Array) =>
  unir(
    texto(tipo),
    Uint8Array.from(u32(datos.length)),
    datos,
    datos.length % 2 ? Uint8Array.of(0) : new Uint8Array(),
  );

const riff = (cuerpo: Uint8Array) =>
  unir(texto("RIFF"), Uint8Array.from(u32(cuerpo.length + 4)), texto("WEBP"), cuerpo);

export const VP8_DE_PRUEBA = Uint8Array.of(9, 8, 7, 6, 5);

/** Banderas VP8X: ICC 0x20, alfa 0x10, EXIF 0x08, XMP 0x04, animación 0x02. */
const vp8x = (banderas: number) =>
  chunkRiff("VP8X", Uint8Array.of(banderas, 0, 0, 0, 0, 0, 0, 0, 0, 0));

export const webpConMetadatos = (orientacion = 6) =>
  riff(
    unir(
      vp8x(0x20 | 0x10 | 0x08 | 0x04),
      chunkRiff("ICCP", texto("perfil de color")),
      chunkRiff("VP8 ", VP8_DE_PRUEBA),
      chunkRiff("EXIF", tiffCompleto(orientacion)),
      chunkRiff("XMP ", texto(XMP_DE_PRUEBA)),
    ),
  );

export const webpAnimada = () =>
  riff(unir(vp8x(0x02), chunkRiff("ANIM", new Uint8Array(6)), chunkRiff("ANMF", VP8_DE_PRUEBA)));

export const pngAnimado = () =>
  unir(
    FIRMA_PNG,
    chunkPng("IHDR", IHDR),
    chunkPng("acTL", new Uint8Array(8)),
    chunkPng("IDAT", IDAT_DE_PRUEBA),
    chunkPng("IEND", new Uint8Array()),
  );
