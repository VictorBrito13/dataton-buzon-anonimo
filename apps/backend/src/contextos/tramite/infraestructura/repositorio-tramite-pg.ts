import type { Etapa, TipoFalta } from "@dataton/shared";
import type { PoolClient } from "pg";
import { enTransaccion } from "../../../compartido/infraestructura/transaccion.js";
import { pool } from "../../../db/postgres.js";
import type {
  DetalleCrudo,
  EvidenciaParaAutoridad,
  RepositorioTramite,
  TransaccionTramite,
} from "../aplicacion/puertos.js";

const MAX_LISTADO = 500;

const COLUMNAS_RESUMEN = `id, estado, municipio, tipo_falta AS "tipoFalta", ente_id AS "enteId",
  etapa, to_char(recibida_dia, 'YYYY-MM-DD') AS "recibidaDia"`;

interface FilaResumen {
  id: string;
  estado: string;
  municipio: string | null;
  tipoFalta: TipoFalta;
  enteId: string | null;
  etapa: Etapa;
  recibidaDia: string;
}

const INSERTAR_BITACORA =
  "INSERT INTO bitacora_autoridad (usuario_id, accion, denuncia_id) VALUES ($1, $2, $3)";

const transaccionSobre = (cliente: PoolClient): TransaccionTramite => ({
  etapaBloqueada: async (id) => {
    const { rows } = await cliente.query<{ etapa: Etapa }>(
      "SELECT etapa FROM denuncias WHERE id = $1 FOR UPDATE",
      [id],
    );
    return rows[0]?.etapa ?? null;
  },
  cambiarEtapa: async (id, etapa, dia) => {
    await cliente.query("UPDATE denuncias SET etapa = $2 WHERE id = $1", [id, etapa]);
    await cliente.query(
      `INSERT INTO denuncia_etapas (denuncia_id, etapa, dia, orden)
       VALUES ($1, $2, $3,
         (SELECT COALESCE(MAX(orden), 0) + 1 FROM denuncia_etapas WHERE denuncia_id = $1))`,
      [id, etapa, dia],
    );
  },
  agregarMensaje: async (id, cuerpoCifrado, dia) => {
    await cliente.query(
      `INSERT INTO mensajes (denuncia_id, autor, cuerpo_cifrado, dia, orden)
       VALUES ($1, 'autoridad', $2, $3,
         (SELECT COALESCE(MAX(orden), 0) + 1 FROM mensajes WHERE denuncia_id = $1))`,
      [id, Buffer.from(cuerpoCifrado), dia],
    );
  },
  registrar: async (usuarioId, accion, denunciaId) => {
    await cliente.query(INSERTAR_BITACORA, [usuarioId, accion, denunciaId]);
  },
});

export class RepositorioTramitePg implements RepositorioTramite {
  transaccion<T>(fn: (tx: TransaccionTramite) => Promise<T>): Promise<T> {
    return enTransaccion((cliente) => fn(transaccionSobre(cliente)));
  }

  async registrar(usuarioId: string, accion: string, denunciaId: string | null): Promise<void> {
    await pool.query(INSERTAR_BITACORA, [usuarioId, accion, denunciaId]);
  }

  /** Por día e identificador aleatorio: el orden no permite inferir el orden de llegada. */
  async listar(): Promise<{ denuncias: FilaResumen[]; total: number }> {
    const [filas, conteo] = await Promise.all([
      pool.query<FilaResumen>(
        `SELECT ${COLUMNAS_RESUMEN} FROM denuncias ORDER BY recibida_dia DESC, id LIMIT $1`,
        [MAX_LISTADO],
      ),
      pool.query<{ total: number }>("SELECT count(*)::int AS total FROM denuncias"),
    ]);
    return { denuncias: filas.rows, total: conteo.rows[0]?.total ?? 0 };
  }

  async detalle(id: string): Promise<DetalleCrudo | null> {
    const denuncia = await pool.query<FilaResumen & { relatoSellado: Buffer }>(
      `SELECT ${COLUMNAS_RESUMEN}, relato_sellado AS "relatoSellado" FROM denuncias WHERE id = $1`,
      [id],
    );
    const fila = denuncia.rows[0];
    if (!fila) return null;
    const [etapas, evidencias, mensajes] = await Promise.all([
      pool.query<{ etapa: Etapa; dia: string }>(
        "SELECT etapa, to_char(dia, 'YYYY-MM-DD') AS dia FROM denuncia_etapas WHERE denuncia_id = $1 ORDER BY orden",
        [id],
      ),
      pool.query<{ id: string; tipo: string }>(
        "SELECT id, tipo FROM evidencias WHERE denuncia_id = $1 ORDER BY id",
        [id],
      ),
      pool.query<{
        autor: "autoridad" | "denunciante";
        dia: string;
        cuerpoCifrado: Buffer | null;
        cuerpoSellado: Buffer | null;
      }>(
        `SELECT autor, to_char(dia, 'YYYY-MM-DD') AS dia,
           cuerpo_cifrado AS "cuerpoCifrado", cuerpo_sellado AS "cuerpoSellado"
         FROM mensajes WHERE denuncia_id = $1 ORDER BY orden`,
        [id],
      ),
    ]);
    return {
      ...fila,
      lineaTiempo: etapas.rows,
      evidencias: evidencias.rows,
      mensajes: mensajes.rows,
    };
  }

  async evidencia(denunciaId: string, evidenciaId: string): Promise<EvidenciaParaAutoridad | null> {
    const { rows } = await pool.query<{ tipo: string; blob_sellado: Buffer }>(
      "SELECT tipo, blob_sellado FROM evidencias WHERE id = $1 AND denuncia_id = $2",
      [evidenciaId, denunciaId],
    );
    const fila = rows[0];
    return fila ? { tipo: fila.tipo, blobSellado: fila.blob_sellado } : null;
  }
}
