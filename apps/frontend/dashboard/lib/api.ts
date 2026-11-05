/** Cliente mínimo: mismo origen y sin credenciales ambientales para quien denuncia. */
export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    message: string,
  ) {
    super(message);
  }
}

export const llamarApi = async <T>(ruta: string, opciones: RequestInit = {}): Promise<T> => {
  const respuesta = await fetch(`/api/v1${ruta}`, {
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    ...opciones,
    headers: {
      ...(typeof opciones.body === "string" ? { "Content-Type": "application/json" } : {}),
      ...opciones.headers,
    },
  });
  const cuerpo: unknown = respuesta.status === 204 ? undefined : await respuesta.json();
  if (!respuesta.ok) {
    const mensaje = (cuerpo as { error?: { message?: string } } | undefined)?.error?.message;
    throw new ErrorApi(respuesta.status, mensaje ?? "No pudimos completar la solicitud.");
  }
  return cuerpo as T;
};
