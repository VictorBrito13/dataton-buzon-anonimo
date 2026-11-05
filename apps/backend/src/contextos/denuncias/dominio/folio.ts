const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** D2: 80 bits, que en Crockford Base32 son exactamente 16 caracteres. */
export const BYTES_FOLIO = 10;

export const folioDesdeBytes = (bytes: Uint8Array): string => {
  if (bytes.length !== BYTES_FOLIO) throw new Error(`El folio requiere ${BYTES_FOLIO} bytes`);
  let bits = 0n;
  for (const byte of bytes) bits = (bits << 8n) | BigInt(byte);
  let texto = "";
  for (let desplazamiento = 75n; desplazamiento >= 0n; desplazamiento -= 5n) {
    texto += ALFABETO[Number((bits >> desplazamiento) & 31n)];
  }
  return `BZ-${texto.slice(0, 4)}-${texto.slice(4, 8)}-${texto.slice(8, 12)}-${texto.slice(12)}`;
};
