/** Resultado de un limpiador: los bytes nuevos y lo que se encontró y quitó. */
export interface BytesLimpios {
  bytes: Uint8Array;
  eliminados: string[];
}

/** El archivo no se pudo limpiar. El mensaje es apto para mostrarlo a la persona. */
export class ErrorLimpieza extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorLimpieza";
  }
}
