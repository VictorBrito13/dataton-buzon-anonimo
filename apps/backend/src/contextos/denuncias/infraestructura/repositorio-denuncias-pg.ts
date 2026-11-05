import type { Etapa } from "@dataton/shared";
import { enTransaccion } from "../../../compartido/infraestructura/transaccion.js";
import { pool } from "../../../db/postgres.js";
import type {
  RepositorioDenuncias,
  ResultadoCreacion,
  Seguimiento,
  ViaAcceso,
} from "../aplicacion/puertos.js";
import type { Denuncia } from "../dominio/denuncia.js";

const COLUMNA: Record<ViaAcceso, string> = { folio: "folio_hmac", acceso: "acceso_hmac" };

/** Señal interna para deshacer la transacción con un resultado esperado, no con un fallo. */
class Abortar extends Error {
  constructor(readonly resultado: ResultadoCreacion) {
    super(resultado);
  }
}

export class RepositorioDenunciasPg implements RepositorioDenuncias {
  async crear(
    denuncia: Denuncia,
    huellas: { folio: Uint8Array; acceso: Uint8Array },
  ): Promise<ResultadoCreacion> {
    try {
      return await enTransaccion(async (cliente) => {
        const insertada = await cliente.query<{ id: string }>(
          `INSERT INTO denuncias
             (folio_hmac, acceso_hmac, estado, municipio, tipo_falta, ente_id, etapa, recibida_dia, relato_sellado)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (acceso_hmac) DO NOTHING
           RETURNING id`,
          [
            Buffer.from(huellas.folio),
            Buffer.from(huellas.acceso),
            denuncia.estado,
            denuncia.municipio,
            denuncia.tipoFalta,
            denuncia.enteId,
            denuncia.etapa,
            denuncia.recibidaDia,
            Buffer.from(denuncia.relatoSellado),
          ],
        );
        const id = insertada.rows[0]?.id;
        if (!id) throw new Abortar("acceso_duplicado");

        await cliente.query(
          "INSERT INTO denuncia_etapas (denuncia_id, etapa, dia, orden) VALUES ($1, $2, $3, 1)",
          [id, denuncia.etapa, denuncia.recibidaDia],
        );
        if (denuncia.evidenciaIds.length > 0) {
          const ligadas = await cliente.query(
            "UPDATE evidencias SET denuncia_id = $1 WHERE id = ANY($2::uuid[]) AND denuncia_id IS NULL",
            [id, denuncia.evidenciaIds],
          );
          if (ligadas.rowCount !== denuncia.evidenciaIds.length) {
            throw new Abortar("evidencia_invalida");
          }
        }
        return "creada" as const;
      });
    } catch (error) {
      if (error instanceof Abortar) return error.resultado;
      throw error;
    }
  }

  async tamanosEvidencias(ids: readonly string[]): Promise<number[]> {
    if (ids.length === 0) return [];
    const { rows } = await pool.query<{ tamano: number }>(
      "SELECT octet_length(blob_sellado) AS tamano FROM evidencias WHERE id = ANY($1::uuid[]) AND denuncia_id IS NULL",
      [ids],
    );
    return rows.map((r) => r.tamano);
  }

  async buscarId(via: ViaAcceso, huella: Uint8Array): Promise<string | null> {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM denuncias WHERE ${COLUMNA[via]} = $1`,
      [Buffer.from(huella)],
    );
    return rows[0]?.id ?? null;
  }

  async seguimiento(id: string): Promise<Seguimiento> {
    const [denuncia, etapas, mensajes] = await Promise.all([
      pool.query<{ etapa: Etapa }>("SELECT etapa FROM denuncias WHERE id = $1", [id]),
      pool.query<{ etapa: Etapa; dia: string }>(
        "SELECT etapa, to_char(dia, 'YYYY-MM-DD') AS dia FROM denuncia_etapas WHERE denuncia_id = $1 ORDER BY orden",
        [id],
      ),
      pool.query<{
        autor: "autoridad" | "denunciante";
        dia: string;
        cuerpo_cifrado: Buffer | null;
      }>(
        "SELECT autor, to_char(dia, 'YYYY-MM-DD') AS dia, cuerpo_cifrado FROM mensajes WHERE denuncia_id = $1 ORDER BY orden",
        [id],
      ),
    ]);
    const etapaActual = denuncia.rows[0]?.etapa;
    if (!etapaActual) throw new Error("Denuncia no encontrada");
    return {
      etapaActual,
      lineaTiempo: etapas.rows,
      mensajes: mensajes.rows.map((m) => ({
        autor: m.autor,
        dia: m.dia,
        cuerpoCifrado: m.cuerpo_cifrado,
      })),
    };
  }

  async agregarMensajeDenunciante(
    id: string,
    cuerpoSellado: Uint8Array,
    dia: string,
  ): Promise<void> {
    await enTransaccion(async (cliente) => {
      await cliente.query("SELECT 1 FROM denuncias WHERE id = $1 FOR UPDATE", [id]);
      await cliente.query(
        `INSERT INTO mensajes (denuncia_id, autor, cuerpo_sellado, dia, orden)
         VALUES ($1, 'denunciante', $2, $3,
           (SELECT COALESCE(MAX(orden), 0) + 1 FROM mensajes WHERE denuncia_id = $1))`,
        [id, Buffer.from(cuerpoSellado), dia],
      );
    });
  }
}
