import { respuestaConfiguracion, respuestaDenuncia, respuestaEvidencia } from "@dataton/shared";
import { llamarApi } from "@/lib/api";
import type { PuertoBuzon } from "@/lib/denuncia/puertos";

/** Con mala señal una petición colgada no debe dejar a la persona esperando sin respuesta. */
const TIEMPO_PETICION_MS = 45_000;
const TIEMPO_SUBIDA_MS = 180_000;

const conTiempo = (ms: number = TIEMPO_PETICION_MS) => ({ signal: AbortSignal.timeout(ms) });

const enviarJson = (ruta: string, cuerpo: unknown) =>
  llamarApi<unknown>(ruta, { method: "POST", body: JSON.stringify(cuerpo), ...conTiempo() });

let configuracion: ReturnType<PuertoBuzon["obtenerConfiguracion"]> | null = null;

/** Adaptador HTTP del puerto del buzón. La credencial siempre va en el cuerpo, nunca en la URL. */
export const buzonHttp: PuertoBuzon = {
  obtenerConfiguracion: () => {
    configuracion ??= llamarApi<unknown>("/configuracion", conTiempo())
      .then((c) => respuestaConfiguracion.parse(c))
      .catch((error: unknown) => {
        configuracion = null;
        throw error;
      });
    return configuracion;
  },
  subirEvidencia: async (archivo, pow) =>
    respuestaEvidencia.parse(
      await llamarApi<unknown>(`/evidencias?pow=${encodeURIComponent(pow)}`, {
        method: "POST",
        body: archivo,
        headers: { "Content-Type": archivo.type },
        ...conTiempo(TIEMPO_SUBIDA_MS),
      }),
    ),
  crearDenuncia: async (solicitud) =>
    respuestaDenuncia.parse(await enviarJson("/denuncias", solicitud)),
  consultar: (solicitud) => enviarJson("/acceso/consulta", solicitud),
  enviarMensaje: (solicitud) => enviarJson("/acceso/mensajes", solicitud),
};
