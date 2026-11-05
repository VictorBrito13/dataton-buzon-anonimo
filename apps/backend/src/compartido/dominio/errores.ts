/** Regla de negocio incumplida. Infraestructura la traduce a HTTP; el dominio no conoce HTTP. */
export class ErrorDominio extends Error {
  constructor(
    readonly codigo: string,
    message: string,
  ) {
    super(message);
    this.name = "ErrorDominio";
  }
}
