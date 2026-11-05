export interface Reloj {
  ahora(): Date;
  /** Zona IANA con la que un instante se redondea al día que se guarda. */
  zona: string;
}

/** Comprueba una prueba de trabajo y la consume: cada solución sirve una sola vez. */
export interface VerificadorPow {
  consumir(pow: string): Promise<boolean>;
}

/** Cifrado en reposo de los mensajes de la autoridad; el contexto liga el texto a su denuncia. */
export interface CifradorMensajes {
  cifrar(texto: string, contexto: string): Uint8Array;
  descifrar(bytes: Uint8Array, contexto: string): string;
}
