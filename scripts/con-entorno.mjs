#!/usr/bin/env node
/**
 * Lanza un comando con NODE_ENV=development si no viene definido. Sustituye a
 * `NODE_ENV=${NODE_ENV:-development} cmd`, que npm no puede ejecutar en Windows (usa cmd.exe).
 *
 * Uso: node scripts/con-entorno.mjs <comando> [argumentos...]
 *
 * Si el comando es el nombre de un paquete instalado con `bin` (p. ej. `tsx`), se ejecuta con el
 * mismo Node que corre este script: los envoltorios .cmd de node_modules/.bin no se pueden lanzar
 * sin shell en Windows.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Copia del entorno con NODE_ENV fijado a development cuando falta o está vacío. */
export const entornoCon = (entorno) => ({
  ...entorno,
  NODE_ENV: entorno.NODE_ENV ? entorno.NODE_ENV : "development",
});

/** Ruta al ejecutable JS de un paquete con `bin`, o null si el comando no es un paquete. */
export const resolverBin = (comando, desde = process.cwd()) => {
  if (!/^[a-z0-9@][a-z0-9._/-]*$/i.test(comando)) return null;
  try {
    const requerir = createRequire(path.join(desde, "package.json"));
    const rutaPaquete = requerir.resolve(`${comando}/package.json`);
    const { bin } = requerir(rutaPaquete);
    const relativo = typeof bin === "string" ? bin : bin?.[comando];
    return relativo ? path.join(path.dirname(rutaPaquete), relativo) : null;
  } catch {
    return null;
  }
};

const esPrincipal =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (esPrincipal) {
  const [comando, ...argumentos] = process.argv.slice(2);
  if (!comando) {
    console.error("Uso: node scripts/con-entorno.mjs <comando> [argumentos...]");
    process.exit(2);
  }
  const bin = resolverBin(comando);
  const resultado = bin
    ? spawnSync(process.execPath, [bin, ...argumentos], {
        stdio: "inherit",
        env: entornoCon(process.env),
      })
    : spawnSync(comando, argumentos, { stdio: "inherit", env: entornoCon(process.env) });
  if (resultado.error) {
    console.error(resultado.error.message);
    process.exit(1);
  }
  process.exit(resultado.status ?? 1);
}
