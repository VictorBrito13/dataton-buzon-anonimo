import { pool } from "../../../db/postgres.js";
import type { EvidenciaSellada, RepositorioEvidencias } from "../aplicacion/puertos.js";

export class RepositorioEvidenciasPg implements RepositorioEvidencias {
  async guardar({ tipo, blobSellado, subidaDia }: EvidenciaSellada): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(
      "INSERT INTO evidencias (tipo, blob_sellado, subida_dia) VALUES ($1, $2, $3) RETURNING id",
      [tipo, Buffer.from(blobSellado), subidaDia],
    );
    return (rows[0] as { id: string }).id;
  }

  async eliminarSinDenunciaAntesDe(dia: string): Promise<number> {
    const { rowCount } = await pool.query(
      "DELETE FROM evidencias WHERE denuncia_id IS NULL AND subida_dia < $1",
      [dia],
    );
    return rowCount ?? 0;
  }
}
