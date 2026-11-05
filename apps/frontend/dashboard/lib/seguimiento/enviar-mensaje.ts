import { aBase64Url, solicitudMensajeDenunciante, type Credencial } from "@dataton/shared";
import type { PuertoBuzon, PuertoTrabajo, Sellar } from "@/lib/denuncia/puertos";

export const MAX_MENSAJE = 5000;

export interface DependenciasMensaje {
  buzon: Pick<PuertoBuzon, "obtenerConfiguracion" | "enviarMensaje">;
  trabajo: Pick<PuertoTrabajo, "resolverPow">;
  sellar: Sellar;
}

/** El mensaje se sella en el navegador: solo la autoridad puede abrirlo (D3). */
export const enviarMensaje = async (
  { credencial, texto }: { credencial: Credencial; texto: string },
  { buzon, trabajo, sellar }: DependenciasMensaje,
): Promise<void> => {
  const cuerpo = texto.trim();
  if (!cuerpo) throw new Error("Escribe tu mensaje antes de enviarlo.");
  if (cuerpo.length > MAX_MENSAJE) {
    throw new Error(`Tu mensaje es demasiado largo. El máximo es de ${MAX_MENSAJE} caracteres.`);
  }
  const { clavePublicaAutoridad } = await buzon.obtenerConfiguracion();
  const sello = await sellar(clavePublicaAutoridad, new TextEncoder().encode(cuerpo));
  const pow = await trabajo.resolverPow();
  await buzon.enviarMensaje(
    solicitudMensajeDenunciante.parse({ pow, credencial, cuerpoSellado: aBase64Url(sello) }),
  );
};
