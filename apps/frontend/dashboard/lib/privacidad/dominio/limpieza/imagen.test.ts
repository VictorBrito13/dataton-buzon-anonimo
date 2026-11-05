import { describe, expect, it } from "vitest";
import {
  AUTOR_EXIF_DE_PRUEBA,
  ENTROPIA_DE_PRUEBA,
  IDAT_DE_PRUEBA,
  LATITUD_DE_PRUEBA,
  MARCA_DE_PRUEBA,
  SERIE_DE_PRUEBA,
  VP8_DE_PRUEBA,
  contiene,
  jpegConMetadatos,
  jpegSinMetadatos,
  pngAnimado,
  pngConMetadatos,
  pngSinMetadatos,
  unir,
  webpAnimada,
  webpConMetadatos,
} from "./ejemplos";
import { ErrorLimpieza } from "./errores";
import { esAnimada, leerOrientacion, limpiarJpeg, limpiarPng, limpiarWebp } from "./imagen";

const SECRETOS = [LATITUD_DE_PRUEBA, MARCA_DE_PRUEBA, AUTOR_EXIF_DE_PRUEBA, SERIE_DE_PRUEBA];

describe("limpiarJpeg", () => {
  it("el ejemplo sí trae los metadatos antes de limpiar", () => {
    const original = jpegConMetadatos();
    for (const secreto of [...SECRETOS, "xmpmeta", "IPTC", "Comentario Secreto", "VIDEO OCULTO"]) {
      expect(contiene(original, secreto), secreto).toBe(true);
    }
  });

  it("quita GPS, EXIF, XMP, IPTC, comentario y datos tras el final", () => {
    const { bytes } = limpiarJpeg(jpegConMetadatos());
    for (const secreto of [...SECRETOS, "xmpmeta", "IPTC", "Comentario Secreto", "VIDEO OCULTO"]) {
      expect(contiene(bytes, secreto), secreto).toBe(false);
    }
  });

  it("reporta lo que había, leído del archivo", () => {
    const { eliminados } = limpiarJpeg(jpegConMetadatos());
    expect(eliminados).toEqual(
      expect.arrayContaining([
        "Ubicación GPS",
        "Marca de la cámara",
        "Autor",
        "Fecha y hora",
        "Programa utilizado",
        "Número de serie de la cámara",
        "Datos XMP",
        "Datos IPTC",
        "Comentario",
        "Perfil de color",
        "Datos ocultos al final del archivo",
      ]),
    );
    expect(new Set(eliminados).size).toBe(eliminados.length);
  });

  it("no reporta nada que no estuviera", () => {
    const { eliminados, bytes } = limpiarJpeg(jpegSinMetadatos());
    expect(eliminados).toEqual([]);
    expect(bytes).toEqual(jpegSinMetadatos());
  });

  it("conserva intacta la imagen, también los bytes que parecen marcadores", () => {
    expect(contiene(limpiarJpeg(jpegConMetadatos()).bytes, ENTROPIA_DE_PRUEBA)).toBe(true);
  });

  it("respeta la orientación: conserva solo esa etiqueta", () => {
    expect(leerOrientacion(jpegConMetadatos(6), "jpeg")).toBe(6);
    const { bytes } = limpiarJpeg(jpegConMetadatos(6));
    expect(leerOrientacion(bytes, "jpeg")).toBe(6);
  });

  it("no agrega EXIF si la orientación es la normal", () => {
    const { bytes } = limpiarJpeg(jpegConMetadatos(1));
    expect(contiene(bytes, "Exif")).toBe(false);
  });

  it("limpiar dos veces no encuentra nada más", () => {
    const una = limpiarJpeg(jpegConMetadatos());
    const dos = limpiarJpeg(una.bytes);
    expect(dos.eliminados).toEqual([]);
    expect(dos.bytes).toEqual(una.bytes);
  });

  it("no acepta bytes que no son un JPEG", () => {
    expect(() => limpiarJpeg(new Uint8Array([1, 2, 3, 4]))).toThrow(ErrorLimpieza);
  });

  it("no se cuelga ni acepta un JPEG truncado en una cabecera", () => {
    const truncado = jpegConMetadatos().slice(0, 30);
    expect(() => limpiarJpeg(truncado)).toThrow(ErrorLimpieza);
  });
});

describe("limpiarPng", () => {
  it("quita eXIf, texto, XMP, fecha y datos tras el final, y lo reporta", () => {
    const original = pngConMetadatos();
    for (const secreto of [...SECRETOS, "Autora PNG Secreta", "xmpmeta", "DATOS OCULTOS"]) {
      expect(contiene(original, secreto), secreto).toBe(true);
    }
    const { bytes, eliminados } = limpiarPng(original);
    for (const secreto of [...SECRETOS, "Autora PNG Secreta", "xmpmeta", "DATOS OCULTOS", "tIME"]) {
      expect(contiene(bytes, secreto), secreto).toBe(false);
    }
    expect(eliminados).toEqual(
      expect.arrayContaining([
        "Ubicación GPS",
        "Autor",
        "Programa utilizado",
        "Datos XMP",
        "Fecha de modificación de la imagen",
        "Datos ocultos al final del archivo",
      ]),
    );
  });

  it("conserva la imagen y la orientación", () => {
    const { bytes } = limpiarPng(pngConMetadatos(6));
    expect(contiene(bytes, IDAT_DE_PRUEBA)).toBe(true);
    expect(leerOrientacion(bytes, "png")).toBe(6);
  });

  it("un PNG sin metadatos queda igual y sin reportes", () => {
    const { bytes, eliminados } = limpiarPng(pngSinMetadatos());
    expect(eliminados).toEqual([]);
    expect(bytes).toEqual(pngSinMetadatos());
  });

  it("quita fragmentos desconocidos: se conserva solo lo que se sabe inofensivo", () => {
    const base = pngSinMetadatos();
    const tamanoIend = 12;
    const raro = unir(
      base.slice(0, base.length - tamanoIend),
      Uint8Array.of(0, 0, 0, 3, 0x70, 0x72, 0x56, 0x74, 0x41, 0x42, 0x43, 0, 0, 0, 0),
      base.slice(base.length - tamanoIend),
    );
    const { bytes, eliminados } = limpiarPng(raro);
    expect(contiene(bytes, "prVt")).toBe(false);
    expect(eliminados).toContain("Otros datos incrustados");
  });

  it("rechaza lo que no es PNG", () => {
    expect(() => limpiarPng(jpegSinMetadatos())).toThrow(ErrorLimpieza);
  });
});

describe("limpiarWebp", () => {
  it("quita EXIF, XMP e ICC, apaga sus banderas y corrige el tamaño", () => {
    const original = webpConMetadatos(1);
    for (const secreto of SECRETOS) expect(contiene(original, secreto), secreto).toBe(true);
    const { bytes, eliminados } = limpiarWebp(original);
    for (const secreto of [...SECRETOS, "xmpmeta", "XMP ", "ICCP", "EXIF"]) {
      expect(contiene(bytes, secreto), secreto).toBe(false);
    }
    expect(contiene(bytes, VP8_DE_PRUEBA)).toBe(true);
    expect(eliminados).toEqual(
      expect.arrayContaining(["Ubicación GPS", "Datos XMP", "Perfil de color"]),
    );
    const banderas = bytes[20];
    expect(banderas & 0x2c).toBe(0);
    expect(banderas & 0x10).toBe(0x10);
    const vista = new DataView(bytes.buffer, bytes.byteOffset);
    expect(vista.getUint32(4, true)).toBe(bytes.length - 8);
  });

  it("conserva la orientación y enciende solo la bandera EXIF", () => {
    const { bytes } = limpiarWebp(webpConMetadatos(6));
    expect(leerOrientacion(bytes, "webp")).toBe(6);
    expect(bytes[20] & 0x08).toBe(0x08);
    expect(contiene(bytes, MARCA_DE_PRUEBA)).toBe(false);
  });

  it("rechaza lo que no es WebP", () => {
    expect(() => limpiarWebp(pngSinMetadatos())).toThrow(ErrorLimpieza);
  });
});

describe("esAnimada", () => {
  it("distingue animaciones, que el canvas destruiría", () => {
    expect(esAnimada(pngAnimado(), "png")).toBe(true);
    expect(esAnimada(pngSinMetadatos(), "png")).toBe(false);
    expect(esAnimada(webpAnimada(), "webp")).toBe(true);
    expect(esAnimada(webpConMetadatos(), "webp")).toBe(false);
    expect(esAnimada(jpegSinMetadatos(), "jpeg")).toBe(false);
  });
});
