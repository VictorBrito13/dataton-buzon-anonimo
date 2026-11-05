#!/usr/bin/env node
/**
 * API del tablero con la base llena: tiempo de respuesta y tamaño, con y sin compresión, por Caddy.
 * Uso: node scripts/rendimiento/medir-api.mjs https://localhost:3943 [salida.json] [muestras]
 */
import { writeFileSync } from "node:fs";
import http2 from "node:http2";

const [base = "https://localhost:3943", salida, muestrasTexto = "30"] = process.argv.slice(2);
const MUESTRAS = Number(muestrasTexto);
const cliente = http2.connect(base, { rejectUnauthorized: false });

const pedir = (ruta, codificacion) =>
  new Promise((resolver, rechazar) => {
    const inicio = performance.now();
    const flujo = cliente.request({ ":path": ruta, "accept-encoding": codificacion });
    let cabeceras = {};
    const trozos = [];
    flujo.on("response", (c) => {
      cabeceras = c;
    });
    flujo.on("data", (t) => trozos.push(t));
    flujo.on("end", () =>
      resolver({
        cuerpo: Buffer.concat(trozos),
        cabeceras,
        ms: performance.now() - inicio,
      }),
    );
    flujo.on("error", rechazar);
    flujo.end();
  });

const { cuerpo } = await pedir("/api/v1/publico/periodos", "identity");
const periodo = JSON.parse(cuerpo.toString()).periodos[0].periodo;

const P = "/api/v1/publico";
const RUTAS = [
  `${P}/periodos`,
  `${P}/agregados?dimensiones=estado&periodo=${periodo}`,
  `${P}/agregados?dimensiones=tipoFalta&periodo=${periodo}`,
  `${P}/agregados?dimensiones=etapa&periodo=${periodo}`,
  `${P}/agregados?dimensiones=tipoFalta,etapa&periodo=${periodo}`,
  `${P}/agregados?dimensiones=municipio&periodo=${periodo}`,
  `${P}/indicadores?periodo=${periodo}`,
  `${P}/metodologia`,
  `${P}/pdn`,
  "/tablero",
];

const percentil = (valores, p) => {
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.floor(orden.length * p))];
};

const filas = [];
for (const ruta of RUTAS) {
  const tiempos = [];
  let estado = null;
  for (let i = 0; i < MUESTRAS; i += 1) {
    const { ms, cabeceras } = await pedir(ruta, "gzip, br, zstd");
    tiempos.push(ms);
    estado = cabeceras[":status"];
  }
  const crudo = await pedir(ruta, "identity");
  const comprimido = await pedir(ruta, "gzip, br, zstd");
  filas.push({
    ruta: ruta.replace(P, "").replace(`&periodo=${periodo}`, "").replace(`?periodo=${periodo}`, ""),
    estado,
    p50ms: Math.round(percentil(tiempos, 0.5)),
    p95ms: Math.round(percentil(tiempos, 0.95)),
    bytes: crudo.cuerpo.length,
    comprimido: comprimido.cuerpo.length,
    codificacion: comprimido.cabeceras["content-encoding"] ?? "ninguna",
    cache: comprimido.cabeceras["cache-control"] ?? null,
  });
}
cliente.close();
console.table(filas);
if (salida)
  writeFileSync(
    salida,
    JSON.stringify({ fecha: new Date().toISOString(), periodo, filas }, null, 2),
  );
