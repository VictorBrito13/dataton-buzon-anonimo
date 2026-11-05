import sharp, { type Metadata } from "sharp";
import { ErrorDominio } from "../../../compartido/dominio/errores.js";
import type { ResultadoLimpieza } from "../aplicacion/puertos.js";

/** Cota contra bombas de descompresión. */
const MAX_PIXELES = 50_000_000;

const metadatosPresentes = (meta: Metadata): string[] => {
  const presentes: string[] = [];
  if (meta.exif) presentes.push("EXIF (cámara, fecha y ubicación GPS, si las había)");
  if (meta.xmp) presentes.push("XMP (autor, programa de edición)");
  if (meta.iptc) presentes.push("IPTC (autor, descripción)");
  if (meta.icc) presentes.push("Perfil de color del dispositivo");
  if (meta.comments?.length) presentes.push("Comentarios de texto");
  return presentes;
};

/**
 * Recodifica desde los píxeles: nada de lo que no sea imagen sobrevive, tampoco datos pegados al
 * final del archivo. La orientación EXIF se aplica antes de perderse.
 */
export const limpiarImagen = async (
  tipo: string,
  bytes: Uint8Array,
): Promise<ResultadoLimpieza> => {
  try {
    const opciones = {
      limitInputPixels: MAX_PIXELES,
      failOn: "error" as const,
      animated: tipo === "image/webp",
    };
    const entrada = await sharp(bytes, opciones).metadata();
    let tuberia = sharp(bytes, opciones);
    if ((entrada.pages ?? 1) === 1) tuberia = tuberia.autoOrient();
    if (tipo === "image/jpeg") tuberia = tuberia.jpeg({ quality: 90 });
    else if (tipo === "image/png") tuberia = tuberia.png();
    else tuberia = tuberia.webp({ quality: 90 });
    const salida = await tuberia.toBuffer();
    return {
      bytes: new Uint8Array(salida),
      eliminados: metadatosPresentes(entrada),
      residuales: metadatosPresentes(
        await sharp(salida, { animated: opciones.animated }).metadata(),
      ),
    };
  } catch {
    throw new ErrorDominio("evidencia_danada", "No pudimos leer esta imagen.");
  }
};
