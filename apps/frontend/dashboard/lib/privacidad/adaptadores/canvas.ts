import type { FormatoImagen } from "../dominio/limpieza/imagen";

/**
 * Re-codifica una imagen dibujándola en un canvas: lo único que sobrevive son
 * los píxeles, ya rotados según la orientación. Devuelve null si el navegador no
 * lo permite o no es confiable; entonces se usa el limpiador de bytes.
 */

const CALIDAD_JPEG = 0.92;
const TOLERANCIA_COLOR = 2;
const COLOR_DE_PRUEBA = [10, 20, 30];

const MIME: Record<FormatoImagen, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Tor Browser y otros navegadores bloquean leer el canvas contra el rastreo y
 * devuelven una imagen en blanco. Usarlo así destruiría la evidencia en silencio,
 * y son justo los navegadores que usaría quien denuncia.
 */
const lecturaConfiable = () => {
  const lienzo = document.createElement("canvas");
  lienzo.width = 2;
  lienzo.height = 2;
  const contexto = lienzo.getContext("2d", { willReadFrequently: true });
  if (!contexto) return false;
  const [r, g, b] = COLOR_DE_PRUEBA;
  contexto.fillStyle = `rgb(${r}, ${g}, ${b})`;
  contexto.fillRect(0, 0, 2, 2);
  const { data } = contexto.getImageData(0, 0, 1, 1);
  return COLOR_DE_PRUEBA.every((valor, i) => Math.abs(data[i] - valor) <= TOLERANCIA_COLOR);
};

export const recodificarConCanvas = async (
  bytes: Uint8Array,
  formato: FormatoImagen,
): Promise<Uint8Array | null> => {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
  try {
    if (!lecturaConfiable()) return null;
    const mime = MIME[formato];
    const mapa = await createImageBitmap(new Blob([bytes as BlobPart], { type: mime }), {
      imageOrientation: "from-image",
    });
    try {
      const lienzo = document.createElement("canvas");
      lienzo.width = mapa.width;
      lienzo.height = mapa.height;
      const contexto = lienzo.getContext("2d");
      if (!contexto) return null;
      contexto.drawImage(mapa, 0, 0);
      const blob = await new Promise<Blob | null>((resolver) =>
        lienzo.toBlob(resolver, mime, CALIDAD_JPEG),
      );
      // Safari entrega PNG si se le pide WebP: no se cambia el formato a escondidas.
      if (!blob || blob.type !== mime) return null;
      return new Uint8Array(await blob.arrayBuffer());
    } finally {
      mapa.close();
    }
  } catch {
    return null;
  }
};
