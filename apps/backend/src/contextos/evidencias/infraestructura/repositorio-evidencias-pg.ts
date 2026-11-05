import { pool } from "../../../db/postgres.js";
import type { EvidenciaSellada, RepositorioEvidencias } from "../aplicacion/puertos.js";
import type { UsoHuerfanas } from "../dominio/politica.js";

export class RepositorioEvidenciasPg implements RepositorioEvidencias {
  async guardar({ tipo, blobSellado, subidaDia }: EvidenciaSellada): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(
      "INSERT INTO evidencias (tipo, blob_sellado, subida_dia) VALUES ($1, $2, $3) RETURNING id",
      [tipo, Buffer.from(blobSellado), subidaDia],
    );
    return (rows[0] as { id: string }).id;
  }

  async usoHuerfanas(): Promise<UsoHuerfanas> {
    const { rows } = await pool.query<{ filas: number; bytes: string }>(
      `SELECT count(*)::int AS filas, coalesce(sum(octet_length(blob_sellado)), 0)::text AS bytes
       FROM evidencias WHERE denuncia_id IS NULL`,
    );
    const fila = rows[0] as { filas: number; bytes: string };
    return { filas: fila.filas, bytes: Number(fila.bytes) };
  }

  async eliminarSinDenunciaAntesDe(dia: string): Promise<number> {
    const { rowCount } = await pool.query(
      "DELETE FROM evidencias WHERE denuncia_id IS NULL AND subida_dia < $1",
      [dia],
    );
    return rowCount ?? 0;
  }
}
