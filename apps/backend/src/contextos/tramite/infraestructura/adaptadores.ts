import { createHash, randomBytes } from "node:crypto";
import { pool } from "../../../db/postgres.js";
import { hashSecret, verifySecret } from "../../../security/argon2.js";
import type {
  AlmacenSesiones,
  RepositorioUsuarios,
  UsuarioAutoridad,
  VerificadorContrasena,
} from "../aplicacion/puertos.js";
import type { Sesion } from "../dominio/sesion.js";

const MAX_SESIONES = 10_000;

const claveDe = (token: string): string => createHash("sha256").update(token).digest("hex");

/** En memoria: un reinicio cierra las sesiones. Solo guarda el hash del token. */
export class AlmacenSesionesMemoria implements AlmacenSesiones {
  private readonly sesiones = new Map<string, Sesion>();

  constructor(private readonly ahoraMs: () => number = Date.now) {}

  crear(sesion: Sesion): string {
    if (this.sesiones.size >= MAX_SESIONES) {
      const ahora = this.ahoraMs();
      for (const [clave, s] of this.sesiones) {
        if (s.expiraMs <= ahora) this.sesiones.delete(clave);
      }
      if (this.sesiones.size >= MAX_SESIONES) throw new Error("Demasiadas sesiones activas");
    }
    const token = randomBytes(32).toString("base64url");
    this.sesiones.set(claveDe(token), sesion);
    return token;
  }

  obtener(token: string): Sesion | null {
    return this.sesiones.get(claveDe(token)) ?? null;
  }

  borrar(token: string): void {
    this.sesiones.delete(claveDe(token));
  }
}

export class VerificadorArgon2 implements VerificadorContrasena {
  private hashSenuelo: Promise<string> | undefined;

  async verificar(hash: string | null, contrasena: string): Promise<boolean> {
    this.hashSenuelo ??= hashSecret(randomBytes(32).toString("hex"));
    const objetivo = hash ?? (await this.hashSenuelo);
    try {
      const correcta = await verifySecret(objetivo, contrasena);
      return hash !== null && correcta;
    } catch {
      return false;
    }
  }
}

export class RepositorioUsuariosPg implements RepositorioUsuarios {
  async buscar(usuario: string): Promise<UsuarioAutoridad | null> {
    const { rows } = await pool.query<{ id: string; usuario: string; contrasena_hash: string }>(
      "SELECT id, usuario, contrasena_hash FROM autoridad_usuarios WHERE usuario = $1",
      [usuario],
    );
    const fila = rows[0];
    return fila ? { id: fila.id, usuario: fila.usuario, hash: fila.contrasena_hash } : null;
  }
}
