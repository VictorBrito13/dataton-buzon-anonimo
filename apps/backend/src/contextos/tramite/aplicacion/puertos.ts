import type { Etapa, ResumenDenunciaAutoridad, TipoFalta } from "@dataton/shared";
import type { Sesion } from "../dominio/sesion.js";

export interface UsuarioAutoridad {
  id: string;
  usuario: string;
  hash: string;
}

export interface RepositorioUsuarios {
  buscar(usuario: string): Promise<UsuarioAutoridad | null>;
}

export interface VerificadorContrasena {
  /** Con hash nulo también gasta el tiempo de una verificación, para no revelar qué usuarios existen. */
  verificar(hash: string | null, contrasena: string): Promise<boolean>;
}

export interface AlmacenSesiones {
  crear(sesion: Sesion): string;
  obtener(token: string): Sesion | null;
  borrar(token: string): void;
}

export interface Bitacora {
  registrar(usuarioId: string, accion: string, denunciaId: string | null): Promise<void>;
}

export interface TransaccionTramite extends Bitacora {
  /** Bloquea la fila hasta terminar la transacción, para que dos cambios no se pisen. */
  etapaBloqueada(id: string): Promise<Etapa | null>;
  cambiarEtapa(id: string, etapa: Etapa, dia: string): Promise<void>;
  agregarMensaje(id: string, cuerpoCifrado: Uint8Array, dia: string): Promise<void>;
}

export interface DetalleCrudo {
  id: string;
  estado: string;
  municipio: string | null;
  tipoFalta: TipoFalta;
  enteId: string | null;
  etapa: Etapa;
  recibidaDia: string;
  relatoSellado: Uint8Array;
  lineaTiempo: { etapa: Etapa; dia: string }[];
  evidencias: { id: string; tipo: string }[];
  mensajes: {
    autor: "autoridad" | "denunciante";
    dia: string;
    cuerpoCifrado: Uint8Array | null;
    cuerpoSellado: Uint8Array | null;
  }[];
}

export interface EvidenciaParaAutoridad {
  tipo: string;
  blobSellado: Uint8Array;
}

export interface RepositorioTramite extends Bitacora {
  transaccion<T>(fn: (tx: TransaccionTramite) => Promise<T>): Promise<T>;
  listar(): Promise<{
    denuncias: (Omit<ResumenDenunciaAutoridad, "estado"> & { estado: string })[];
    total: number;
  }>;
  detalle(id: string): Promise<DetalleCrudo | null>;
  evidencia(denunciaId: string, evidenciaId: string): Promise<EvidenciaParaAutoridad | null>;
}
