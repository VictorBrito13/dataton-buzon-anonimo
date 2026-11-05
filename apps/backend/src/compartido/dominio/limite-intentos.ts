export interface OpcionesLimite {
  maximo: number;
  ventanaMs: number;
  /** Cota de memoria: con la tabla llena de ventanas vigentes se falla cerrado. */
  maxClaves: number;
}

/** Ventana fija por clave. La clave nunca es una IP: es un HMAC de credencial o una constante. */
export class LimiteIntentos {
  private readonly ventanas = new Map<string, { conteo: number; finMs: number }>();

  constructor(private readonly opciones: OpcionesLimite) {}

  permitir(clave: string, ahoraMs: number): boolean {
    const vigente = this.ventanas.get(clave);
    if (vigente && vigente.finMs > ahoraMs) {
      if (vigente.conteo >= this.opciones.maximo) return false;
      vigente.conteo += 1;
      return true;
    }
    this.ventanas.delete(clave);
    if (this.ventanas.size >= this.opciones.maxClaves) {
      this.purgar(ahoraMs);
      if (this.ventanas.size >= this.opciones.maxClaves) return false;
    }
    this.ventanas.set(clave, { conteo: 1, finMs: ahoraMs + this.opciones.ventanaMs });
    return true;
  }

  private purgar(ahoraMs: number): void {
    for (const [clave, ventana] of this.ventanas) {
      if (ventana.finMs <= ahoraMs) this.ventanas.delete(clave);
    }
  }
}
