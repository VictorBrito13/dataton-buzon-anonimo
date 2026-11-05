/**
 * Sellado híbrido: cualquiera con la clave pública cifra; solo la autoridad abre.
 * ECDH P-256 efímero + HKDF-SHA-256 + AES-256-GCM, solo con WebCrypto, disponible
 * igual en navegadores y en Node. El servidor guarda únicamente la clave pública,
 * por lo que un volcado de la base de datos no revela relatos ni evidencias.
 *
 * Formato: versión (1 byte) | clave pública efímera (65) | iv (12) | texto cifrado.
 */
const VERSION = 1;
const LARGO_PUBLICA = 65;
const LARGO_IV = 12;
const INFO = new TextEncoder().encode("buzon-anonimo/sello/v1");
const ECDH = { name: "ECDH", namedCurve: "P-256" } as const;

const claveSimetrica = async (
  privada: CryptoKey,
  publica: CryptoKey,
  sal: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> => {
  const secreto = await crypto.subtle.deriveBits({ name: "ECDH", public: publica }, privada, 256);
  const base = await crypto.subtle.importKey("raw", secreto, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: sal, info: INFO },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
};

export const generarParDeClaves = async (): Promise<{
  publica: JsonWebKey;
  privada: JsonWebKey;
}> => {
  const par = await crypto.subtle.generateKey(ECDH, true, ["deriveBits"]);
  return {
    publica: await crypto.subtle.exportKey("jwk", par.publicKey),
    privada: await crypto.subtle.exportKey("jwk", par.privateKey),
  };
};

export const sellar = async (
  publicaJwk: JsonWebKey,
  datos: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> => {
  const destinatario = await crypto.subtle.importKey("jwk", publicaJwk, ECDH, false, []);
  const efimera = await crypto.subtle.generateKey(ECDH, false, ["deriveBits"]);
  const publicaEfimera = new Uint8Array(await crypto.subtle.exportKey("raw", efimera.publicKey));
  const clave = await claveSimetrica(efimera.privateKey, destinatario, publicaEfimera);
  const iv = crypto.getRandomValues(new Uint8Array(LARGO_IV));
  const cifrado = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, clave, datos),
  );

  const salida = new Uint8Array(1 + LARGO_PUBLICA + LARGO_IV + cifrado.length);
  salida[0] = VERSION;
  salida.set(publicaEfimera, 1);
  salida.set(iv, 1 + LARGO_PUBLICA);
  salida.set(cifrado, 1 + LARGO_PUBLICA + LARGO_IV);
  return salida;
};

export const abrir = async (
  privadaJwk: JsonWebKey,
  sello: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> => {
  if (sello[0] !== VERSION) throw new Error("Versión de sello no reconocida");
  const publicaEfimera = sello.slice(1, 1 + LARGO_PUBLICA);
  const iv = sello.slice(1 + LARGO_PUBLICA, 1 + LARGO_PUBLICA + LARGO_IV);
  const cifrado = sello.slice(1 + LARGO_PUBLICA + LARGO_IV);
  const privada = await crypto.subtle.importKey("jwk", privadaJwk, ECDH, false, ["deriveBits"]);
  const efimera = await crypto.subtle.importKey("raw", publicaEfimera, ECDH, false, []);
  const clave = await claveSimetrica(privada, efimera, publicaEfimera);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, clave, cifrado));
};

/** Base64url en ambos entornos, para transportar sellos dentro de JSON. */
export const aBase64Url = (bytes: Uint8Array): string => {
  // Por bloques: pasar todos los bytes como argumentos desborda la pila cerca de 125 KB.
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const deBase64Url = (texto: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(texto.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
