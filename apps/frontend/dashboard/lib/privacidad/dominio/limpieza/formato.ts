/** El formato se decide por el contenido: el nombre y el tipo declarado se pueden falsear. */
export type Formato = "jpeg" | "png" | "webp" | "pdf" | "office";

const ascii = (bytes: Uint8Array, inicio: number, fin: number) =>
  String.fromCharCode(...bytes.subarray(inicio, fin));

export const detectarFormato = (bytes: Uint8Array): Formato | null => {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (ascii(bytes, 0, 8) === "\x89PNG\r\n\x1a\n") return "png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";
  if (ascii(bytes, 0, 5) === "%PDF-") return "pdf";
  if (ascii(bytes, 0, 4) === "PK\x03\x04") return "office";
  return null;
};

const ACEPTADOS = "Se aceptan JPEG, PNG, WebP, PDF, DOCX, XLSX y PPTX.";

/** Explica por qué un archivo no se puede limpiar. Nunca se sube sin limpiar. */
export const motivoDeRechazo = (bytes: Uint8Array): string => {
  if (ascii(bytes, 4, 8) === "ftyp" && /^(hei|hev|mif|msf|avi)/.test(ascii(bytes, 8, 12))) {
    return `No podemos limpiar fotos HEIC o AVIF, y podrían llevar tu ubicación. Conviértela a JPEG y vuelve a intentarlo. ${ACEPTADOS}`;
  }
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    return `Este archivo es de Office antiguo o protegido con contraseña y no podemos limpiarlo. Guárdalo sin contraseña en un formato actual. ${ACEPTADOS}`;
  }
  return `No podemos limpiar este tipo de archivo, así que no se puede subir. ${ACEPTADOS}`;
};
