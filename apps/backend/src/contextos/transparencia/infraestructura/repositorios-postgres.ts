import type { Etapa } from "@dataton/shared";
import type { Pool } from "pg";
import type {
  DenunciaFuente,
  FilaAgregado,
  FuenteDenuncias,
  LecturaAgregados,
  RepositorioPublicacion,
} from "../aplicacion/puertos.js";
import type { Motivo } from "../dominio/k-anonimato.js";

interface FilaBd {
  dimensiones: string;
  claves: Record<string, string>;
  conteo: number | null;
  motivo: Motivo;
  k: number;
  detalle: unknown;
}

const aFila = ({ dimensiones, claves, conteo, motivo, k, detalle }: FilaBd): FilaAgregado => ({
  dimensiones,
  claves,
  conteo,
  motivo,
  k,
  ...(detalle === null ? {} : { detalle }),
});

const COLUMNAS = "dimensiones, claves, conteo, motivo, k, detalle";

/** Solo lee `agregados_publicos`; se construye con la conexión del rol de solo lectura. */
export const crearLecturaAgregados = (pool: Pick<Pool, "query">): LecturaAgregados => ({
  listarPeriodos: async () => {
    const { rows } = await pool.query<{ periodo: string; k: number }>(
      "SELECT periodo, max(k) AS k FROM agregados_publicos GROUP BY periodo ORDER BY periodo DESC",
    );
    return rows;
  },
  leerTabla: async (periodo, dimensiones) => {
    const { rows } = await pool.query<FilaBd>(
      `SELECT ${COLUMNAS} FROM agregados_publicos WHERE periodo = $1 AND dimensiones = $2 ORDER BY claves`,
      [periodo, dimensiones],
    );
    return rows.map(aFila);
  },
  leerPeriodo: async (periodo) => {
    const { rows } = await pool.query<FilaBd>(
      `SELECT ${COLUMNAS} FROM agregados_publicos WHERE periodo = $1 ORDER BY dimensiones, claves`,
      [periodo],
    );
    return rows.map(aFila);
  },
});

/** Solo la usa el proceso de agregación, nunca una ruta HTTP. */
export const crearRepositorioPublicacion = (pool: Pool): RepositorioPublicacion => ({
  periodosPublicados: async () => {
    const { rows } = await pool.query<{ periodo: string }>(
      "SELECT DISTINCT periodo FROM agregados_publicos",
    );
    return rows.map((r) => r.periodo);
  },
  guardarPeriodo: async (periodo, filas) => {
    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");
      await cliente.query(
        `INSERT INTO agregados_publicos (periodo, dimensiones, claves, conteo, motivo, k, detalle)
         SELECT $1, x.dimensiones, x.claves, x.conteo, x.motivo, x.k, x.detalle
         FROM jsonb_to_recordset($2::jsonb) AS x(
           dimensiones text, claves jsonb, conteo integer, motivo text, k integer, detalle jsonb
         )`,
        [periodo, JSON.stringify(filas)],
      );
      await cliente.query("COMMIT");
    } catch (error) {
      await cliente.query("ROLLBACK");
      throw error;
    } finally {
      cliente.release();
    }
  },
});

interface FilaDenuncia {
  estado: string;
  municipio: string | null;
  tipo_falta: string;
  ente_id: string | null;
  recibida_dia: string;
  etapas: { etapa: Etapa; dia: string }[] | null;
  respuesta_dia: string | null;
}

/** Nunca selecciona relato, credenciales ni evidencias. */
export const crearFuenteDenuncias = (pool: Pick<Pool, "query">): FuenteDenuncias => ({
  denunciasRecibidasEntre: async (inicio, fin) => {
    const { rows } = await pool.query<FilaDenuncia>(
      `SELECT d.estado, d.municipio, d.tipo_falta, d.ente_id, d.recibida_dia::text AS recibida_dia,
         (SELECT jsonb_agg(jsonb_build_object('etapa', e.etapa, 'dia', e.dia::text) ORDER BY e.dia, e.orden)
            FROM (SELECT etapa, dia, CASE etapa
                    WHEN 'recibida' THEN 0 WHEN 'turnada_investigadora' THEN 1
                    WHEN 'analisis_competencia' THEN 2 WHEN 'en_investigacion' THEN 3
                    WHEN 'sin_competencia' THEN 3 WHEN 'substanciacion' THEN 4
                    WHEN 'archivada' THEN 4 WHEN 'tribunal' THEN 5 ELSE 6 END AS orden
                  FROM denuncia_etapas WHERE denuncia_id = d.id) e) AS etapas,
         (SELECT min(m.dia)::text FROM mensajes m
           WHERE m.denuncia_id = d.id AND m.autor = 'autoridad') AS respuesta_dia
       FROM denuncias d
       WHERE d.recibida_dia BETWEEN $1::date AND $2::date
       ORDER BY d.recibida_dia`,
      [inicio, fin],
    );
    return rows.map((r): DenunciaFuente => ({
      estado: r.estado,
      municipio: r.municipio,
      tipoFalta: r.tipo_falta,
      enteId: r.ente_id,
      recibidaDia: r.recibida_dia,
      etapas: r.etapas ?? [{ etapa: "recibida", dia: r.recibida_dia }],
      respuestaDia: r.respuesta_dia,
    }));
  },
});
