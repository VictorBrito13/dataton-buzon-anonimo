export interface Sesion {
  usuarioId: string;
  usuario: string;
  expiraMs: number;
}

export const sesionVigente = (sesion: Sesion, ahoraMs: number): boolean =>
  ahoraMs < sesion.expiraMs;
