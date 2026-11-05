export type CatalogoS5 = "entidades" | "municipios" | "faltas";

export type RegistroCatalogoS5 = Record<string, unknown> & { id: number; nombre: string };

export interface EstadisticasS5 {
  metrics: Record<string, number> & { totalDenuncias: number };
  monthly: Record<string, unknown>[];
}

/** Datos no sensibles de una denuncia. Nunca incluye relato, evidencias ni credenciales. */
export interface EnvioDenunciaS5 {
  estado: string;
  municipio: string | null;
  tipoFalta: string;
  enteId: string | null;
  dia: string;
}

/**
 * Frontera con el S5 (HU-06). Las lecturas están comprobadas contra la versión de pruebas; el
 * envío está diseñado pero bloqueado: ver "Adaptador S5" en el README del backend.
 */
export interface AdaptadorS5 {
  catalogo(catalogo: CatalogoS5): Promise<RegistroCatalogoS5[]>;
  estadisticas(): Promise<EstadisticasS5>;
  registrarDenuncia(envio: EnvioDenunciaS5): Promise<{ referencia: string }>;
}
