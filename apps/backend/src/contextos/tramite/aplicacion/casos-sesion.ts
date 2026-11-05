import type { Reloj } from "../../../compartido/aplicacion/puertos.js";
import { ErrorDominio } from "../../../compartido/dominio/errores.js";
import type { LimiteIntentos } from "../../../compartido/dominio/limite-intentos.js";
import { accionBitacora } from "../dominio/bitacora.js";
import { sesionVigente, type Sesion } from "../dominio/sesion.js";
import type {
  AlmacenSesiones,
  Bitacora,
  RepositorioUsuarios,
  VerificadorContrasena,
} from "./puertos.js";

export class CasosSesion {
  constructor(
    private readonly puertos: {
      usuarios: RepositorioUsuarios;
      hasher: VerificadorContrasena;
      almacen: AlmacenSesiones;
      bitacora: Bitacora;
      reloj: Reloj;
      limite: LimiteIntentos;
    },
    private readonly duracionMs: number,
  ) {}

  async iniciar(usuario: string, contrasena: string): Promise<{ token: string; usuario: string }> {
    const { usuarios, hasher, almacen, bitacora, reloj, limite } = this.puertos;
    const ahoraMs = reloj.ahora().getTime();
    if (!limite.permitir(usuario, ahoraMs)) {
      throw new ErrorDominio("demasiados_intentos", "Demasiados intentos. Espera unos minutos.");
    }
    const encontrado = await usuarios.buscar(usuario);
    const valida = await hasher.verificar(encontrado?.hash ?? null, contrasena);
    if (!encontrado || !valida) {
      throw new ErrorDominio("credenciales_invalidas", "Usuario o contraseña incorrectos.");
    }
    const token = almacen.crear({
      usuarioId: encontrado.id,
      usuario: encontrado.usuario,
      expiraMs: ahoraMs + this.duracionMs,
    });
    await bitacora.registrar(encontrado.id, accionBitacora.sesionIniciada, null);
    return { token, usuario: encontrado.usuario };
  }

  actual(token: string): Sesion | null {
    const { almacen, reloj } = this.puertos;
    const sesion = almacen.obtener(token);
    if (!sesion) return null;
    if (!sesionVigente(sesion, reloj.ahora().getTime())) {
      almacen.borrar(token);
      return null;
    }
    return sesion;
  }

  async cerrar(token: string): Promise<void> {
    const { almacen, bitacora } = this.puertos;
    const sesion = this.actual(token);
    almacen.borrar(token);
    if (sesion) await bitacora.registrar(sesion.usuarioId, accionBitacora.sesionCerrada, null);
  }
}
