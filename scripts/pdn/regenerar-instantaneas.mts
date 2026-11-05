/**
 * Regenera las instantáneas de la PDN en apps/backend/datos/pdn. El backend solo lee estos
 * archivos: en tiempo de ejecución no hay ninguna llamada a terceros.
 *
 * Uso (desde apps/backend):
 *   npx tsx ../../scripts/pdn/regenerar-instantaneas.mts --s3-csv <conteos.csv> [--cache <dir>] [--sin-s6]
 *
 * --s3-csv  CSV `carpeta_proveedor,ente,n`, ya reducido a conteos por institución. Los paquetes
 *           S3 traen campos personales: se reducen fuera del repositorio y nunca se versionan.
 * --cache   directorio con c_municipios.json, entes_all.json y s6_buyers.json ya descargados.
 * --sin-s6  no consulta S6 y conserva el archivo existente.
 * --reusar-s6  no consulta S6: reprocesa los conteos del archivo existente.
 *
 * Usa fetch sin simular un navegador, de forma secuencial y con pausa entre consultas.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  consolidarCompradores,
  consolidarConteosS3,
  normalizarNombre,
  regexExacta,
  type CompradorS6,
  type FilaS3,
} from "../../apps/backend/src/contextos/transparencia/dominio/instituciones.js";

const API_S6 = "https://api.plataformadigitalnacional.org/s6/api/v1";
const S5 = "https://dev-denuncias.plataformadigitalnacional.org/next-api/public/catalogos";
const COBERTURA = "https://cobertura.plataformadigitalnacional.org/directus/items/entes?limit=-1";
const PAUSA_MS = 1000;
const UMBRAL_S3 = 5;
const LICENCIA = "No encontrada. Pendiente de confirmar con SESNA.";
/** Registros del paquete S3 sin institución, contados al reducirlo; quedan fuera del CSV. */
const REGISTROS_S3_SIN_ENTE = 38;

const DESTINO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../apps/backend/datos/pdn",
);
const hoy = new Date().toISOString().slice(0, 10);

const opcion = (nombre: string): string | undefined => {
  const i = process.argv.indexOf(nombre);
  return i === -1 ? undefined : process.argv[i + 1];
};
const cache = opcion("--cache");

const leerFuente = async <T,>(archivo: string, url: string): Promise<T> => {
  const local = cache ? path.join(cache, archivo) : undefined;
  if (local && existsSync(local)) return JSON.parse(readFileSync(local, "utf8")) as T;
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`${url} respondió ${respuesta.status}`);
  return (await respuesta.json()) as T;
};

const guardar = (archivo: string, contenido: unknown): void => {
  mkdirSync(DESTINO, { recursive: true });
  writeFileSync(path.join(DESTINO, archivo), `${JSON.stringify(contenido, null, 1)}\n`);
  console.log(`[pdn] ${archivo}`);
};

/** Parser mínimo de CSV con comillas. */
const parsearCsv = (texto: string): string[][] => {
  const filas: string[][] = [];
  for (const linea of texto.split(/\r?\n/)) {
    if (!linea) continue;
    const campos: string[] = [];
    let actual = "";
    let entreComillas = false;
    for (let i = 0; i < linea.length; i += 1) {
      const c = linea.charAt(i);
      if (c === '"' && entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i += 1;
      } else if (c === '"') entreComillas = !entreComillas;
      else if (c === "," && !entreComillas) {
        campos.push(actual);
        actual = "";
      } else actual += c;
    }
    campos.push(actual);
    filas.push(campos);
  }
  return filas;
};

interface MunicipioS5 {
  nombre: string;
  claveAGEM: string;
  claveAGEE: number;
}
interface EnteCobertura {
  nombre: string;
  entidad: string | null;
  sistema1: boolean;
  sistema2: boolean;
  sistema3: boolean;
  sistema6: boolean;
}

const municipios = async (): Promise<void> => {
  const { data } = await leerFuente<{ data: MunicipioS5[] }>(
    "c_municipios.json",
    `${S5}?catalog=municipios`,
  );
  guardar("municipios.json", {
    fuente: {
      nombre: "Catálogo de municipios del prototipo S5 (versión de pruebas)",
      url: `${S5}?catalog=municipios`,
      consultadoEl: hoy,
      licencia: LICENCIA,
    },
    municipios: data
      .map((m) => ({
        clave: `${String(m.claveAGEE).padStart(2, "0")}${m.claveAGEM}`,
        nombre: m.nombre,
      }))
      .sort((a, b) => a.clave.localeCompare(b.clave)),
  });
};

const s3 = (csv: string): void => {
  const [, ...filas] = parsearCsv(readFileSync(csv, "utf8"));
  const conEnte: FilaS3[] = filas.map(([carpeta, ente, n]) => ({
    carpeta: carpeta ?? "",
    ente: ente ?? "",
    n: Number(n),
  }));
  const consolidado = consolidarConteosS3(conEnte, { umbral: UMBRAL_S3 });
  guardar("s3-conteos.json", {
    fuente: {
      nombre: "S3, servidores públicos sancionados: conteos por institución",
      url: "https://api.plataformadigitalnacional.org/s3-wrapper/api/v1/providers",
      consultadoEl: hoy,
      licencia: LICENCIA,
      cobertura:
        "22 proveedores estatales más el IFT, sin proveedor federal general. Solo los estados listados tienen registros con institución en este corte.",
    },
    umbralPorInstitucion: UMBRAL_S3,
    registrosSinInstitucion: REGISTROS_S3_SIN_ENTE,
    ...consolidado,
  });
};

const s6 = async (entes: EnteCobertura[]): Promise<void> => {
  const compradores = await leerFuente<{ name: string }[]>("s6_buyers.json", `${API_S6}/buyers`);
  const jurisdicciones = new Map<string, Set<string>>();
  for (const ente of entes) {
    if (ente.entidad === null) continue;
    const clave = normalizarNombre(ente.nombre);
    jurisdicciones.set(clave, (jurisdicciones.get(clave) ?? new Set()).add(ente.entidad));
  }
  const nombres = [...new Set(compradores.map((c) => c.name))].sort((a, b) => a.localeCompare(b));
  const resultado: CompradorS6[] = [];
  const conJurisdiccion = (nombre: string): string[] =>
    [...(jurisdicciones.get(normalizarNombre(nombre)) ?? [])].sort();

  if (process.argv.includes("--reusar-s6")) {
    const previo = JSON.parse(readFileSync(path.join(DESTINO, "s6-conteos.json"), "utf8")) as {
      fuente: unknown;
      compradores: CompradorS6[];
    };
    guardar("s6-conteos.json", {
      fuente: previo.fuente,
      compradores: consolidarCompradores(
        previo.compradores.map((c) => ({ ...c, jurisdicciones: conJurisdiccion(c.nombre) })),
      ),
    });
    return;
  }

  for (const [i, nombre] of nombres.entries()) {
    const respuesta = await fetch(`${API_S6}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyer_name: regexExacta(nombre), page: 0, pageSize: 1 }),
    });
    if (!respuesta.ok) throw new Error(`S6 respondió ${respuesta.status} para ${nombre}`);
    const { pagination } = (await respuesta.json()) as { pagination: { total: number } };
    resultado.push({
      nombre,
      procedimientos: pagination.total,
      jurisdicciones: conJurisdiccion(nombre),
    });
    if (i % 50 === 0) console.log(`[pdn] S6 ${i + 1}/${nombres.length}`);
    await new Promise((listo) => setTimeout(listo, PAUSA_MS));
  }
  guardar("s6-conteos.json", {
    fuente: {
      nombre: "S6, contrataciones públicas: procedimientos por institución compradora",
      url: `${API_S6}/search`,
      consultadoEl: hoy,
      licencia: LICENCIA,
      cobertura:
        "Ciclos hasta 2021. Consulta por nombre exacto (regex anclada); un procedimiento no implica ninguna irregularidad.",
    },
    compradores: consolidarCompradores(resultado),
  });
};

const cobertura = (entes: EnteCobertura[]): void => {
  const resumen = new Map<string, Record<string, number>>();
  for (const ente of entes) {
    const clave = ente.entidad ?? "sin_entidad";
    const fila = resumen.get(clave) ?? { entes: 0, s1: 0, s2: 0, s3: 0, s6: 0 };
    fila.entes = (fila.entes ?? 0) + 1;
    if (ente.sistema1) fila.s1 = (fila.s1 ?? 0) + 1;
    if (ente.sistema2) fila.s2 = (fila.s2 ?? 0) + 1;
    if (ente.sistema3) fila.s3 = (fila.s3 ?? 0) + 1;
    if (ente.sistema6) fila.s6 = (fila.s6 ?? 0) + 1;
    resumen.set(clave, fila);
  }
  guardar("cobertura-resumen.json", {
    fuente: {
      nombre: "Cobertura de la PDN: entes por entidad y sistema",
      url: COBERTURA,
      consultadoEl: hoy,
      licencia: LICENCIA,
    },
    porEntidad: [...resumen.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([entidad, conteos]) => ({ entidad, ...conteos })),
  });
};

const principal = async (): Promise<void> => {
  const csv = opcion("--s3-csv");
  if (!csv) throw new Error("Falta --s3-csv <conteos.csv>");
  const { data: entes } = await leerFuente<{ data: EnteCobertura[] }>("entes_all.json", COBERTURA);
  await municipios();
  s3(csv);
  cobertura(entes);
  if (!process.argv.includes("--sin-s6")) await s6(entes);
};

await principal();
