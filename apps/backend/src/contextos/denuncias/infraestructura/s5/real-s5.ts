import type {
  AdaptadorS5,
  CatalogoS5,
  EnvioDenunciaS5,
  EstadisticasS5,
  RegistroCatalogoS5,
} from "../../aplicacion/puerto-s5.js";

const TIEMPO_MAXIMO_MS = 10_000;

export interface OpcionesRealS5 {
  baseUrl: string;
  /** Solo con S5_ENVIO_AUTORIZADO=true. SESNA no ha autorizado enviar datos de prueba. */
  envioAutorizado: boolean;
  fetchImpl?: typeof fetch;
}

export class RealS5 implements AdaptadorS5 {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opciones: OpcionesRealS5) {
    this.base = opciones.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = opciones.fetchImpl ?? fetch;
  }

  async catalogo(catalogo: CatalogoS5): Promise<RegistroCatalogoS5[]> {
    const cuerpo = await this.leer<{ data?: unknown }>(
      `/next-api/public/catalogos?catalog=${catalogo}`,
    );
    if (!Array.isArray(cuerpo.data)) throw new Error("S5: respuesta de catálogo inesperada");
    return cuerpo.data as RegistroCatalogoS5[];
  }

  async estadisticas(): Promise<EstadisticasS5> {
    const cuerpo = await this.leer<Partial<EstadisticasS5>>("/next-api/public/estadisticas");
    if (!cuerpo.metrics) throw new Error("S5: respuesta de estadísticas inesperada");
    return { metrics: cuerpo.metrics, monthly: cuerpo.monthly ?? [] };
  }

  /**
   * La ruta se conoce solo por el JS del prototipo: ni la ruta ni esta forma de cuerpo están
   * probadas contra el entorno. El bloqueo es deliberado, no un pendiente de código.
   */
  async registrarDenuncia(envio: EnvioDenunciaS5): Promise<{ referencia: string }> {
    if (!this.opciones.envioAutorizado) {
      throw new Error("S5: envío no autorizado; requiere S5_ENVIO_AUTORIZADO=true y aval de SESNA");
    }
    const respuesta = await this.fetchImpl(`${this.base}/next-api/public/denuncias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envio),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
    if (!respuesta.ok) throw new Error(`S5: el envío respondió ${respuesta.status}`);
    const { folio } = (await respuesta.json()) as { folio?: unknown };
    return { referencia: typeof folio === "string" ? folio : "" };
  }

  private async leer<T>(ruta: string): Promise<T> {
    const respuesta = await this.fetchImpl(`${this.base}${ruta}`, {
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
    if (!respuesta.ok) throw new Error(`S5: la lectura respondió ${respuesta.status}`);
    return (await respuesta.json()) as T;
  }
}
