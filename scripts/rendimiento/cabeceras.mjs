#!/usr/bin/env node
/**
 * Lee del despliegue real lo que la red entrega: compresión, caché y peso de catálogos y API.
 * Sin dependencias. Uso: node scripts/rendimiento/cabeceras.mjs https://localhost:3943 [salida.json]
 */
import { writeFileSync } from "node:fs";
import http2 from "node:http2";

const [base = "https://localhost:3943", salida] = process.argv.slice(2);

const pedir = (ruta, codificacion) =>
  new Promise((resolver, rechazar) => {
    const inicio = performance.now();
    const cliente = http2.connect(base, { rejectUnauthorized: false });
    cliente.on("error", rechazar);
    const flujo = cliente.request({ ":path": ruta, "accept-encoding": codificacion });
    let cabeceras = {};
    let primerByte = 0;
    let bytes = 0;
    flujo.on("response", (c) => {
      cabeceras = c;
      primerByte = performance.now() - inicio;
    });
    flujo.on("data", (trozo) => {
      bytes += trozo.length;
    });
    flujo.on("end", () => {
      cliente.close();
      resolver({ cabeceras, bytes, primerByte, total: performance.now() - inicio });
    });
    flujo.on("error", rechazar);
    flujo.end();
  });

const CHROME = "gzip, deflate, br, zstd";

/** Primer script de la portada: sirve para comprobar la caché de _next/static con una URL real. */
const html = await pedir("/", "identity");
const cliente = http2.connect(base, { rejectUnauthorized: false });
const cuerpo = await new Promise((resolver) => {
  const flujo = cliente.request({ ":path": "/" });
  let texto = "";
  flujo.setEncoding("utf8");
  flujo.on("data", (t) => (texto += t));
  flujo.on("end", () => resolver(texto));
  flujo.end();
});
cliente.close();
const script = /\/_next\/static\/[^"']+\.js/.exec(cuerpo)?.[0];
const hoja = /\/_next\/static\/[^"']+\.css/.exec(cuerpo)?.[0];

const RUTAS = [
  "/",
  "/denunciar",
  "/seguimiento",
  "/tablero",
  "/como-te-protegemos",
  script,
  hoja,
  "/catalogos/municipios.json",
  "/catalogos/entes.json",
  "/api/v1/configuracion",
  "/api/v1/publico/periodos",
].filter(Boolean);

const filas = [];
for (const ruta of RUTAS) {
  const crudo = await pedir(ruta, "identity");
  const zipped = await pedir(ruta, CHROME);
  filas.push({
    ruta: ruta.replace(/\/_next\/static\/.+\.(js|css)$/, "/_next/static/…$1"),
    sinComprimir: crudo.bytes,
    comprimido: zipped.bytes,
    codificacion: zipped.cabeceras["content-encoding"] ?? "ninguna",
    cacheControl: zipped.cabeceras["cache-control"] ?? "(sin cabecera)",
    etag: Boolean(zipped.cabeceras.etag),
  });
}

const resultado = {
  fecha: new Date().toISOString(),
  base,
  htmlCacheControl: html.cabeceras["cache-control"],
  filas,
};
console.table(filas);
if (salida) writeFileSync(salida, JSON.stringify(resultado, null, 2));
