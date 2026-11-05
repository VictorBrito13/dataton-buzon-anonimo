// Genera las versiones ligeras de public/catalogos/ para los selectores de /denunciar.
// Fuente: versión de pruebas del S5, https://dev-denuncias.plataformadigitalnacional.org/,
// respuestas GET de los catálogos c_municipios y entes guardadas como JSON.
// Uso: node scripts/generar-catalogos.mjs <c_municipios.json> <entes_all.json>
// Deja también public/catalogos/fuente.json con el origen y la fecha de consulta (zona de México).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ZONA = "America/Mexico_City";
const S5 = "https://dev-denuncias.plataformadigitalnacional.org";
const LICENCIA = "No publicada. Pendiente de confirmar con SESNA.";
const hoy = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const [rutaMunicipios, rutaEntes] = process.argv.slice(2);
if (!rutaMunicipios || !rutaEntes) {
  throw new Error("Uso: generar-catalogos.mjs <c_municipios.json> <entes_all.json>");
}
const leer = (ruta) => JSON.parse(readFileSync(ruta, "utf8")).data;
const destino = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "catalogos");
mkdirSync(destino, { recursive: true });

// Clave AGEE de dos dígitos -> [clave AGEM, nombre]. Claves que no son del catálogo INEGI se omiten.
const municipios = {};
for (const { nombre, claveAGEE, claveAGEM } of leer(rutaMunicipios)) {
  const estado = String(claveAGEE).padStart(2, "0");
  if (!/^\d{3}$/.test(claveAGEM) || !/^\d{2}$/.test(estado)) continue;
  (municipios[estado] ??= []).push([claveAGEM, nombre]);
}
writeFileSync(join(destino, "municipios.json"), JSON.stringify(municipios));

// Solo id, nombre y entidad: el resto de campos no se necesita para buscar.
const entes = leer(rutaEntes).map(({ id, nombre, entidad }) => [id, nombre, entidad ?? "00"]);
writeFileSync(join(destino, "entes.json"), JSON.stringify(entes));

writeFileSync(
  join(destino, "fuente.json"),
  `${JSON.stringify(
    {
      "municipios.json": {
        fuente: "Catálogo de municipios de la versión de pruebas del S5 de la PDN",
        url: `${S5}/next-api/public/catalogos?catalog=municipios`,
        consultadoEl: hoy,
        licencia: LICENCIA,
      },
      "entes.json": {
        fuente:
          "Catálogo de entes públicos de Cobertura de la PDN, servido por la versión de pruebas del S5",
        url: `${S5}/`,
        consultadoEl: hoy,
        licencia: LICENCIA,
      },
      generadoCon: "apps/frontend/dashboard/scripts/generar-catalogos.mjs",
      zonaHoraria: ZONA,
    },
    null,
    2,
  )}\n`,
);

console.log(
  `municipios: ${Object.values(municipios).flat().length} en ${Object.keys(municipios).length} estados; entes: ${entes.length}`,
);
