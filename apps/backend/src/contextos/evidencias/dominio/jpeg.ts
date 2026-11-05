const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const COM = 0xfe;
const APP1 = 0xe1;
const APP13 = 0xed;

/** EXIF y XMP (APP1), Photoshop/IPTC (APP13) y comentarios. APP0, ICC y Adobe afectan el color. */
const esMetadato = (marca: number): boolean => marca === APP1 || marca === APP13 || marca === COM;

/**
 * Sin recodificar, para no degradar fotos dentro de un PDF. Tras el inicio de escaneo los bytes
 * se conservan hasta el marcador EOI; lo que siga (datos ocultos) se descarta.
 */
export const quitarMetadatosJpeg = (
  entrada: Uint8Array,
): { bytes: Uint8Array; cambio: boolean } => {
  const sinCambio = { bytes: entrada, cambio: false };
  if (entrada[0] !== 0xff || entrada[1] !== SOI) return sinCambio;

  const partes: Uint8Array[] = [entrada.subarray(0, 2)];
  let i = 2;
  while (i + 1 < entrada.length) {
    if (entrada[i] !== 0xff) return sinCambio;
    const marca = entrada[i + 1] as number;
    if (marca === EOI) {
      partes.push(entrada.subarray(i, i + 2));
      i += 2;
      break;
    }
    if (marca === SOS) {
      const fin = buscarFinDeImagen(entrada, i + 2);
      partes.push(entrada.subarray(i, fin));
      i = fin;
      break;
    }
    if (i + 3 >= entrada.length) return sinCambio;
    const largo = ((entrada[i + 2] as number) << 8) | (entrada[i + 3] as number);
    const siguiente = i + 2 + largo;
    if (largo < 2 || siguiente > entrada.length) return sinCambio;
    if (!esMetadato(marca)) partes.push(entrada.subarray(i, siguiente));
    i = siguiente;
  }

  const largoSalida = partes.reduce((suma, parte) => suma + parte.length, 0);
  if (largoSalida === entrada.length) return sinCambio;
  const bytes = new Uint8Array(largoSalida);
  let posicion = 0;
  for (const parte of partes) {
    bytes.set(parte, posicion);
    posicion += parte.length;
  }
  return { bytes, cambio: true };
};

const buscarFinDeImagen = (bytes: Uint8Array, desde: number): number => {
  for (let i = desde; i + 1 < bytes.length; i += 1) {
    if (bytes[i] === 0xff && bytes[i + 1] === EOI) return i + 2;
  }
  return bytes.length;
};
