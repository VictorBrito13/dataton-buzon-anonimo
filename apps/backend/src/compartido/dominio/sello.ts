/** versión (1) + clave efímera (65) + iv (12) + etiqueta GCM (16); ver sello.ts en @dataton/shared. */
export const LARGO_MINIMO_SELLO = 94;
const VERSION_SELLO = 1;

/**
 * Comprobación estructural: el servidor no puede abrir un sello, pero sí detectar a un cliente
 * que por error mande texto claro, para que nunca llegue a la base de datos.
 */
export const selloBienFormado = (bytes: Uint8Array): boolean =>
  bytes.length >= LARGO_MINIMO_SELLO && bytes[0] === VERSION_SELLO;
