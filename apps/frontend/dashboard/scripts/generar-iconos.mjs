// Regenera los iconos binarios a partir del trazo de app/icon.svg. Uso:
//   node apps/frontend/dashboard/scripts/generar-iconos.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const FONDO = "#0b5563";
const FIGURA = "#f7f5f0";

const trazo = readFileSync(join(RAIZ, "app/icon.svg"), "utf8");
const figura = (trazo.match(/<circle[^>]*\/>|<rect class="figura"[^>]*\/>|<path[^>]*\/>/g) ?? [])
  .join("")
  .replaceAll('class="figura"', `fill="${FIGURA}"`)
  .replaceAll('class="solapa"', `fill="none" stroke="${FONDO}"`);

/** Redondeado para pestañas; a sangre para iOS y Android, que recortan la forma por su cuenta. */
const redondeado = `<rect width="32" height="32" rx="7" fill="${FONDO}"/>${figura}`;
const aSangre = (escala) =>
  `<rect width="32" height="32" fill="${FONDO}"/>` +
  `<g transform="translate(16 16) scale(${escala}) translate(-16 -16)">${figura}</g>`;

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ deviceScaleFactor: 1 });
const rasterizar = async (contenido, lado) => {
  await pagina.setViewportSize({ width: lado, height: lado });
  await pagina.setContent(
    `<!doctype html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${lado}" height="${lado}" style="display:block">${contenido}</svg>`,
  );
  return pagina.screenshot({ omitBackground: true });
};

/** Un .ico es un directorio de imágenes; desde Windows Vista cada una puede ser un PNG. */
const crearIco = (imagenes) => {
  const cabecera = Buffer.alloc(6 + 16 * imagenes.length);
  cabecera.writeUInt16LE(1, 2);
  cabecera.writeUInt16LE(imagenes.length, 4);
  let posicion = cabecera.length;
  imagenes.forEach(({ lado, datos }, i) => {
    const entrada = 6 + 16 * i;
    cabecera.writeUInt8(lado, entrada);
    cabecera.writeUInt8(lado, entrada + 1);
    cabecera.writeUInt16LE(1, entrada + 4);
    cabecera.writeUInt16LE(32, entrada + 6);
    cabecera.writeUInt32LE(datos.length, entrada + 8);
    cabecera.writeUInt32LE(posicion, entrada + 12);
    posicion += datos.length;
  });
  return Buffer.concat([cabecera, ...imagenes.map(({ datos }) => datos)]);
};

const ladosIco = [16, 32, 48];
const imagenes = [];
for (const lado of ladosIco) imagenes.push({ lado, datos: await rasterizar(redondeado, lado) });
writeFileSync(join(RAIZ, "app/favicon.ico"), crearIco(imagenes));

writeFileSync(join(RAIZ, "app/apple-icon.png"), await rasterizar(aSangre(0.82), 180));

mkdirSync(join(RAIZ, "public/iconos"), { recursive: true });
writeFileSync(join(RAIZ, "public/iconos/icono-192.png"), await rasterizar(redondeado, 192));
writeFileSync(join(RAIZ, "public/iconos/icono-512.png"), await rasterizar(redondeado, 512));
writeFileSync(
  join(RAIZ, "public/iconos/icono-mascara-512.png"),
  await rasterizar(aSangre(0.72), 512),
);

await navegador.close();
