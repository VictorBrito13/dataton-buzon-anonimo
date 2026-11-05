import type { webcrypto } from "node:crypto";
import { generarParDeClaves } from "@dataton/shared";

type Par = { publica: webcrypto.JsonWebKey; privada: webcrypto.JsonWebKey };

/**
 * Genera el par de claves de la autoridad. La pública va a CLAVE_PUBLICA_AUTORIDAD; la privada se
 * entrega a la autoridad por un canal aparte y NO debe guardarse en el servidor (D3).
 */
const par: unknown = await generarParDeClaves();
const { publica, privada } = par as Par;
const { kty, crv, x, y } = publica;

console.log(`CLAVE_PUBLICA_AUTORIDAD=${JSON.stringify({ kty, crv, x, y })}`);
console.log("\nClave privada (solo para la autoridad; no la guardes en el servidor):");
console.log(JSON.stringify(privada));
