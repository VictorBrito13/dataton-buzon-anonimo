/**
 * Crea los secretos del despliegue en el volumen, una sola vez. Conservarlos importa: sin la
 * pimienta ningún folio ni frase existente vuelve a funcionar. `down -v` los borra junto con la base.
 */
import { chmodSync, chownSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomBytes, webcrypto } from "node:crypto";

const DIR = "/secretos";
const UID_BACKEND = 1000;
const hex32 = () => randomBytes(32).toString("hex");

process.umask(0o077);

const escribirSoloLectura = (ruta, contenido) => {
  writeFileSync(`${ruta}.tmp`, contenido);
  renameSync(`${ruta}.tmp`, ruta);
  chmodSync(ruta, 0o400);
};

const rutaPassword = `${DIR}/db_password`;
if (!existsSync(rutaPassword)) escribirSoloLectura(rutaPassword, hex32());

const rutaEnv = `${DIR}/backend.env`;
const anteriores = existsSync(rutaEnv) ? readFileSync(rutaEnv, "utf8") : "";
const existe = (variable) => new RegExp(`^${variable}=`, "m").test(anteriores);
const nuevas = [];

// Las variables que ya existen se conservan: agregar una aquí no invalida las anteriores.
for (const variable of ["PIMIENTA_ACCESO", "ALTCHA_CLAVE_HMAC", "CLAVE_MENSAJES"]) {
  if (!existe(variable)) nuevas.push(`${variable}=${hex32()}`);
}

if (!existe("DATABASE_URL")) {
  const password = readFileSync(rutaPassword, "utf8");
  nuevas.push(`DATABASE_URL=postgres://dataton:${password}@db:5432/dataton`);
}

if (!existe("DATABASE_URL_PUBLICO")) {
  nuevas.push(`DATABASE_URL_PUBLICO=postgres://buzon_lector_publico:${hex32()}@db:5432/dataton`);
}

if (!existe("CLAVE_PUBLICA_AUTORIDAD")) {
  let publica = process.env.CLAVE_PUBLICA_AUTORIDAD;
  if (!publica) {
    // Solo para que el prototipo arranque con un comando. La privada queda en el volumen, legible
    // únicamente por root: en un uso real se genera fuera del servidor (D3). Ver guía de réplica.
    const par = await webcrypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
      "deriveBits",
    ]);
    const { kty, crv, x, y } = await webcrypto.subtle.exportKey("jwk", par.publicKey);
    publica = JSON.stringify({ kty, crv, x, y });
    const privada = await webcrypto.subtle.exportKey("jwk", par.privateKey);
    escribirSoloLectura(`${DIR}/autoridad_clave_privada.jwk`, JSON.stringify(privada));
  }
  // Comillas simples: el JSON se conserva íntegro al cargarlo con sh.
  nuevas.push(`CLAVE_PUBLICA_AUTORIDAD='${publica}'`);
}

if (nuevas.length > 0) {
  if (existsSync(rutaEnv)) chmodSync(rutaEnv, 0o600);
  escribirSoloLectura(rutaEnv, `${anteriores}${nuevas.join("\n")}\n`);
}

// Postgres lee su contraseña como root antes de bajar de privilegios; el backend, como uid 1000.
chownSync(rutaEnv, UID_BACKEND, UID_BACKEND);
console.log("[secretos] listos");
