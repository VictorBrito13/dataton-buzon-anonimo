/**
 * Crea los secretos del despliegue en el volumen, una sola vez. Conservarlos importa: sin la
 * pimienta ningún folio ni frase existente vuelve a funcionar. `down -v` los borra junto con la base.
 *
 * Tres carpetas, tres volúmenes:
 * - SECRETOS_DIR (volumen `secretos`): lo que el backend y la base necesitan para arrancar.
 * - CLAVE_AUTORIDAD_DIR (volumen `clave-autoridad-demo`): la clave privada de demostración y el
 *   acceso al panel. Ningún servicio en ejecución lo monta (D3); se lee con
 *   `docker compose run --rm --no-deps clave-autoridad`.
 * - SEMILLA_AUTORIDAD_DIR (volumen `semilla-autoridad-demo`): usuario y contraseña demo del panel,
 *   que solo lee `migraciones` para sembrar el hash. El backend nunca los recibe.
 */
import {
  chmodSync,
  chownSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { randomBytes, webcrypto } from "node:crypto";

const DIR = process.env.SECRETOS_DIR || "/secretos";
const DIR_CLAVE = process.env.CLAVE_AUTORIDAD_DIR || "/clave-autoridad";
const DIR_SEMILLA = process.env.SEMILLA_AUTORIDAD_DIR || "/semilla-autoridad";
const UID_BACKEND = 1000;
const USUARIO_DEMO = "autoridad.demo";
const hex = (bytes) => randomBytes(bytes).toString("hex");
const hex32 = () => hex(32);

process.umask(0o077);
mkdirSync(DIR, { recursive: true });
mkdirSync(DIR_CLAVE, { recursive: true });
mkdirSync(DIR_SEMILLA, { recursive: true });

const escribirSoloLectura = (ruta, contenido) => {
  writeFileSync(`${ruta}.tmp`, contenido);
  renameSync(`${ruta}.tmp`, ruta);
  chmodSync(ruta, 0o400);
};
const valorDe = (texto, variable) => new RegExp(`^${variable}=(.*)$`, "m").exec(texto)?.[1];

const rutaPassword = path.join(DIR, "db_password");
if (!existsSync(rutaPassword)) escribirSoloLectura(rutaPassword, hex32());

const rutaEnv = path.join(DIR, "backend.env");
const previas = existsSync(rutaEnv) ? readFileSync(rutaEnv, "utf8") : "";
// Versiones anteriores guardaban aquí la contraseña demo del panel, que el backend exportaba sin
// necesitarla. Se retira de este archivo y se conserva en el volumen de la semilla.
const semillaHeredada = {
  usuario: valorDe(previas, "SEMILLA_AUTORIDAD_USUARIO"),
  contrasena: valorDe(previas, "SEMILLA_AUTORIDAD_CONTRASENA"),
};
const anteriores = previas
  .split("\n")
  .filter((linea) => !linea.startsWith("SEMILLA_AUTORIDAD_"))
  .join("\n");
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

// Usuario demo del panel. Va en su propio volumen: `migraciones` lo lee para guardar el hash
// Argon2id en la base, y quien hace la demostración lo lee del volumen de la clave. El backend no
// recibe esta contraseña: solo verifica el hash que quedó en la base.
const rutaSemilla = path.join(DIR_SEMILLA, "semilla_autoridad.env");
let contrasenaDemo = null;
if (!existsSync(rutaSemilla)) {
  contrasenaDemo = semillaHeredada.contrasena ?? hex(16);
  escribirSoloLectura(
    rutaSemilla,
    `SEMILLA_AUTORIDAD_USUARIO=${semillaHeredada.usuario ?? USUARIO_DEMO}\nSEMILLA_AUTORIDAD_CONTRASENA=${contrasenaDemo}\n`,
  );
}

if (!existe("CLAVE_PUBLICA_AUTORIDAD")) {
  let publica = process.env.CLAVE_PUBLICA_AUTORIDAD;
  if (!publica) {
    // Solo para que el prototipo arranque con un comando. La privada se escribe en su propio
    // volumen, que ningún servicio en ejecución monta. En uso real se genera fuera del servidor
    // y aquí llega solo la pública (D3). Ver docs/guia-de-replica.md.
    const par = await webcrypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
      "deriveBits",
    ]);
    const { kty, crv, x, y } = await webcrypto.subtle.exportKey("jwk", par.publicKey);
    publica = JSON.stringify({ kty, crv, x, y });
    const privada = await webcrypto.subtle.exportKey("jwk", par.privateKey);
    escribirSoloLectura(
      path.join(DIR_CLAVE, "autoridad_clave_privada.jwk"),
      JSON.stringify(privada),
    );
  }
  // Comillas simples: el JSON se conserva íntegro al cargarlo con sh.
  nuevas.push(`CLAVE_PUBLICA_AUTORIDAD='${publica}'`);
}

if (contrasenaDemo) {
  escribirSoloLectura(
    path.join(DIR_CLAVE, "acceso_panel.txt"),
    `usuario=${USUARIO_DEMO}\ncontrasena=${contrasenaDemo}\n`,
  );
}

if (nuevas.length > 0 || anteriores !== previas) {
  if (existsSync(rutaEnv)) chmodSync(rutaEnv, 0o600);
  const cuerpo = nuevas.length > 0 ? `${anteriores}${nuevas.join("\n")}\n` : anteriores;
  escribirSoloLectura(rutaEnv, cuerpo);
}

// Postgres lee su contraseña como root antes de bajar de privilegios; el backend y las migraciones,
// como uid 1000. En el contenedor corre como root; en pruebas locales no hace falta cambiar el dueño.
if (process.getuid?.() === 0) {
  chownSync(rutaEnv, UID_BACKEND, UID_BACKEND);
  chownSync(rutaSemilla, UID_BACKEND, UID_BACKEND);
}
console.log("[secretos] listos");
