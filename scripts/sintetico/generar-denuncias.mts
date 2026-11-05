/**
 * Llena la base con denuncias SINTÉTICAS (HU-27). Nunca usa datos reales y se niega a correr en
 * producción. Reemplaza las sintéticas anteriores; las demás no se tocan.
 *
 * Uso: npm run sintetico -w @dataton/backend -- [--semilla 2026] [--por-trimestre 6000]
 *      [--desde 2025-T3] [--hasta 2026-T3] [--hoy 2026-11-04]
 */
import { createHash } from "node:crypto";
import { ENTES_SINTETICOS } from "@dataton/shared";
import pg from "pg";
import { ZONA_HORARIA_POR_DEFECTO, diaDe } from "../../apps/backend/src/compartido/dominio/dia.js";
import { generarDenunciasSinteticas } from "../../apps/backend/src/contextos/transparencia/aplicacion/generador-sintetico.js";
import { leerMunicipios } from "../../apps/backend/src/contextos/transparencia/infraestructura/fuente-pdn-instantaneas.js";

if (process.env.NODE_ENV === "production") {
  throw new Error("El generador sintético no corre en producción");
}

const opcion = (nombre: string, predeterminado: string): string => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? predeterminado : (process.argv[i + 1] ?? predeterminado);
};

const MARCA = "SINTETICO";

/** Capitales y zonas metropolitanas: reciben mucho más peso que el resto. No es un censo. */
const MUNICIPIOS_GRANDES = [
  "01001",
  "02002",
  "02004",
  "05030",
  "05035",
  "07101",
  "08019",
  "08037",
  "09005",
  "09007",
  "09015",
  "11020",
  "12001",
  "13048",
  "14039",
  "14120",
  "15033",
  "15058",
  "15057",
  "15106",
  "16053",
  "17007",
  "19039",
  "19026",
  "20067",
  "21114",
  "22014",
  "23005",
  "24028",
  "25006",
  "26030",
  "27004",
  "28032",
  "30193",
  "31050",
];

const semilla = Number(opcion("semilla", "2026"));
const denuncias = generarDenunciasSinteticas(
  {
    municipios: leerMunicipios(),
    municipiosGrandes: MUNICIPIOS_GRANDES,
    entes: ENTES_SINTETICOS,
  },
  {
    semilla,
    desde: opcion("desde", "2025-T3"),
    hasta: opcion("hasta", "2026-T3"),
    denunciasPorTrimestre: Number(opcion("por-trimestre", "6000")),
    hoy: opcion("hoy", diaDe(new Date(), process.env.ZONA_HORARIA || ZONA_HORARIA_POR_DEFECTO)),
  },
);

const huella = (texto: string): Buffer => createHash("sha256").update(texto).digest();
const marca = Buffer.from(MARCA);

const cliente = new pg.Client({
  connectionString: process.env.DATABASE_URL ?? "postgres://dataton:dataton@localhost:5432/dataton",
});
await cliente.connect();
try {
  await cliente.query("BEGIN");
  await cliente.query("DELETE FROM denuncias WHERE relato_sellado = $1", [marca]);
  const TAMANO_LOTE = 1000;
  for (let inicio = 0; inicio < denuncias.length; inicio += TAMANO_LOTE) {
    const lote = denuncias.slice(inicio, inicio + TAMANO_LOTE).map((d, i) => ({
      ...d,
      folio: huella(`${MARCA}:${semilla}:folio:${inicio + i}`).toString("hex"),
      acceso: huella(`${MARCA}:${semilla}:acceso:${inicio + i}`).toString("hex"),
      etapa: d.etapas.at(-1)?.etapa ?? "recibida",
    }));
    await cliente.query(
      `WITH entrada AS (
         SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
           folio text, acceso text, estado text, municipio text, "tipoFalta" text, "enteId" text,
           etapa text, "recibidaDia" date, etapas jsonb, "respuestaDia" date
         )
       ), nuevas AS (
         INSERT INTO denuncias (folio_hmac, acceso_hmac, estado, municipio, tipo_falta, ente_id, etapa, recibida_dia, relato_sellado)
         SELECT decode(folio, 'hex'), decode(acceso, 'hex'), estado, municipio, "tipoFalta", "enteId", etapa, "recibidaDia", $2
         FROM entrada
         RETURNING id, folio_hmac
       ), etapas AS (
         INSERT INTO denuncia_etapas (denuncia_id, etapa, dia)
         SELECT n.id, e.etapa, e.dia
         FROM nuevas n
         JOIN entrada x ON decode(x.folio, 'hex') = n.folio_hmac
         CROSS JOIN LATERAL jsonb_to_recordset(x.etapas) AS e(etapa text, dia date)
       )
       INSERT INTO mensajes (denuncia_id, autor, cuerpo_cifrado, dia)
       SELECT n.id, 'autoridad', $2, x."respuestaDia"
       FROM nuevas n
       JOIN entrada x ON decode(x.folio, 'hex') = n.folio_hmac
       WHERE x."respuestaDia" IS NOT NULL`,
      [JSON.stringify(lote), marca],
    );
  }
  await cliente.query("COMMIT");
  console.log(`[sintetico] ${denuncias.length} denuncias sintéticas (semilla ${semilla})`);
} catch (error) {
  await cliente.query("ROLLBACK");
  throw error;
} finally {
  await cliente.end();
}
