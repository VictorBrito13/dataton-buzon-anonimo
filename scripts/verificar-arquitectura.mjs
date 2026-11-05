#!/usr/bin/env node
/**
 * Comprueba la regla de dependencias de D10: infraestructura → aplicacion → dominio.
 * Usa el analizador de TypeScript para no confundir comentarios o cadenas con importaciones.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const FUENTES = "apps/backend/src";
const EXTENSION = /\.(ts|tsx|mts|cts)$/;

const esPaquete = (nombres) => (mod) => nombres.some((n) => mod === n || mod.startsWith(`${n}/`));
const tieneSegmento = (nombre) => (mod) => mod.split("/").includes(nombre);
const esEnv = (mod) => /(^|\/)env(\.[cm]?[jt]s)?$/.test(mod);

const REGLAS = {
  dominio: [
    { regla: "dominio-sin-express", prohibido: esPaquete(["express", "cors", "helmet"]) },
    { regla: "dominio-sin-pg", prohibido: esPaquete(["pg"]) },
    { regla: "dominio-sin-env", prohibido: (mod) => esEnv(mod) || esPaquete(["dotenv"])(mod) },
    { regla: "dominio-sin-infraestructura", prohibido: tieneSegmento("infraestructura") },
    { regla: "dominio-sin-aplicacion", prohibido: tieneSegmento("aplicacion") },
  ],
  aplicacion: [
    { regla: "aplicacion-sin-infraestructura", prohibido: tieneSegmento("infraestructura") },
  ],
};

const listarArchivos = (directorio) =>
  readdirSync(directorio).flatMap((nombre) => {
    const ruta = path.join(directorio, nombre);
    if (statSync(ruta).isDirectory()) return listarArchivos(ruta);
    return EXTENSION.test(nombre) && !nombre.endsWith(".d.ts") ? [ruta] : [];
  });

const usaProcessEnv = (fuente) => {
  let encontrado = false;
  const visitar = (nodo) => {
    if (
      ts.isPropertyAccessExpression(nodo) &&
      nodo.name.text === "env" &&
      ts.isIdentifier(nodo.expression) &&
      nodo.expression.text === "process"
    ) {
      encontrado = true;
    }
    if (!encontrado) ts.forEachChild(nodo, visitar);
  };
  visitar(fuente);
  return encontrado;
};

/** Cada contexto tiene sus capas en contextos/<contexto>/<capa>; compartido, en compartido/<capa>. */
const capaDe = (ruta, raiz) => {
  const partes = path.relative(path.join(raiz, FUENTES), ruta).split(path.sep);
  return partes[0] === "contextos" ? partes[2] : partes[1];
};

/** Devuelve las violaciones como { archivo, regla, modulo }, con rutas relativas a `raiz`. */
export const revisarArquitectura = (raiz) =>
  ["contextos", "compartido"]
    .map((carpeta) => path.join(raiz, FUENTES, carpeta))
    .filter(existsSync)
    .flatMap(listarArchivos)
    .flatMap((ruta) => {
      const capa = capaDe(ruta, raiz);
      const reglas = REGLAS[capa];
      if (!reglas) return [];

      const texto = readFileSync(ruta, "utf8");
      const archivo = path.relative(raiz, ruta).split(path.sep).join("/");
      const violaciones = ts
        .preProcessFile(texto, true, true)
        .importedFiles.flatMap(({ fileName: modulo }) =>
          reglas
            .filter((r) => r.prohibido(modulo))
            .map((r) => ({ archivo, regla: r.regla, modulo })),
        );

      if (capa === "dominio") {
        const fuente = ts.createSourceFile(ruta, texto, ts.ScriptTarget.Latest, false);
        if (usaProcessEnv(fuente)) {
          violaciones.push({ archivo, regla: "dominio-sin-env", modulo: "process.env" });
        }
      }
      return violaciones;
    });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const violaciones = revisarArquitectura(path.resolve(process.argv[2] ?? "."));
  for (const { archivo, regla, modulo } of violaciones) {
    console.error(`${archivo}: ${regla} (importa ${modulo})`);
  }
  if (violaciones.length > 0) {
    console.error(`\n${violaciones.length} violación(es) de arquitectura. Ver D10 en docs/.`);
    process.exit(1);
  }
  console.log("Arquitectura: sin violaciones.");
}
