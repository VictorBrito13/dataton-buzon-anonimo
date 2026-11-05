import { sellar } from "@dataton/shared";
import { enviarDenuncia, type EntradaDenuncia } from "@/lib/denuncia/enviar-denuncia";
import type { EtapaEnvio } from "@/lib/denuncia/espera-envio";
import { buzonHttp } from "./buzon-http";
import { prepararTrabajador, trabajoEnWorker } from "./trabajo";

/**
 * Se importa de forma dinámica desde el paso de envío: los esquemas y el sellado no hacen falta
 * para llenar el formulario, y con mala señal cada kilobyte retrasa el primer paso.
 */
export const enviarDenunciaReal = (
  entrada: EntradaDenuncia,
  informar: (etapa: EtapaEnvio) => void,
): Promise<string> =>
  enviarDenuncia(entrada, { buzon: buzonHttp, trabajo: trabajoEnWorker, sellar }, informar);

/** Solo baja código público, igual para todas las personas: no dice nada de lo que se denuncia. */
export const prepararEnvio = (): void => prepararTrabajador();
