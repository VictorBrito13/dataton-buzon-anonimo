import { llamarApi } from "@/lib/api";
import type { PuertoBuzon } from "@/lib/denuncia/puertos";

/** Con mala señal una petición colgada no debe dejar a la persona esperando sin respuesta. */
const TIEMPO_PETICION_MS = 45_000;
const TIEMPO_SUBIDA_MS = 180_000;

const conTiempo = (ms: number = TIEMPO_PETICION_MS) => ({ signal: AbortSignal.timeout(ms) });

const enviarJson = (ruta: string, cuerpo: unknown) =>
  llamarApi<unknown>(ruta, { method: "POST", body: JSON.stringify(cuerpo), ...conTiempo() });

/**
 * Los esquemas se bajan ANTES de cada petición, nunca después de recibir la respuesta: si la señal
 * se cae justo tras crear la denuncia, el folio ya no se podría validar ni mostrar.
 */
const esquemas = () => import("./esquemas-buzon");

let configuracion: ReturnType<PuertoBuzon["obtenerConfiguracion"]> | null = null;

/** Adaptador HTTP del puerto del buzón. La credencial siempre va en el cuerpo, nunca en la URL. */
export const buzonHttp: PuertoBuzon = {
  obtenerConfiguracion: () => {
    configuracion ??= esquemas()
      .then(async ({ respuestaConfiguracion }) =>
        respuestaConfiguracion.parse(await llamarApi<unknown>("/configuracion", conTiempo())),
      )
      .catch((error: unknown) => {
        configuracion = null;
        throw error;
      });
    return configuracion;
  },
  subirEvidencia: async (archivo, pow) => {
    const { respuestaEvidencia } = await esquemas();
    return respuestaEvidencia.parse(
      await llamarApi<unknown>(`/evidencias?pow=${encodeURIComponent(pow)}`, {
        method: "POST",
        body: archivo,
        headers: { "Content-Type": archivo.type },
        ...conTiempo(TIEMPO_SUBIDA_MS),
      }),
    );
  },
  crearDenuncia: async (solicitud) => {
    const { respuestaDenuncia } = await esquemas();
    return respuestaDenuncia.parse(await enviarJson("/denuncias", solicitud));
  },
  consultar: (solicitud) => enviarJson("/acceso/consulta", solicitud),
  enviarMensaje: (solicitud) => enviarJson("/acceso/mensajes", solicitud),
};
