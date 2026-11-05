"use client";

import Link from "next/link";
import { useState } from "react";
import { BOTON_PRIMARIO, BOTON_SECUNDARIO } from "@/components/ui";
import type { EstadoAsistente } from "@/lib/denuncia/asistente";
import { MENSAJE_QUIZA_YA_LLEGO, mensajeDeErrorEnvio } from "@/lib/denuncia/errores";
import { mensajeEsperaEnvio, progresoEnvio, type EtapaEnvio } from "@/lib/denuncia/espera-envio";
import type { Despachar } from "./asistente";
import { useSegundosEspera } from "./use-segundos-espera";

const cargarEnvio = () => import("@/lib/infraestructura/envio-denuncia");

/**
 * Baja por adelantado lo que falta para enviar. Se llama en el paso de la frase, que siempre toma más
 * que esos segundos. Si falla no pasa nada: enviar lo vuelve a intentar y explica el error.
 */
export const adelantarEnvio = (): void => {
  cargarEnvio().then(
    ({ prepararEnvio }) => prepararEnvio(),
    () => {},
  );
};

export function PasoEnvio({
  estado,
  despachar,
}: {
  estado: EstadoAsistente;
  despachar: Despachar;
}) {
  const [etapa, setEtapa] = useState<EtapaEnvio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intentos, setIntentos] = useState(0);
  const segundos = useSegundosEspera(etapa !== null);

  const enviar = async () => {
    if (!estado.frase) return;
    setError(null);
    // Un reintento tras perder la respuesta repite la misma frase: un 409 ahí casi siempre
    // significa que la denuncia sí llegó. El servidor no cambia; solo cambia cómo se explica.
    const reintento = intentos > 0;
    setIntentos(intentos + 1);
    setEtapa("sellando");
    try {
      const { enviarDenunciaReal } = await cargarEnvio();
      const folio = await enviarDenunciaReal(
        {
          hechos: estado.hechos,
          personas: estado.personas,
          frase: estado.frase,
          evidenciaIds: estado.evidencias.map((e) => e.evidenciaId),
        },
        setEtapa,
      );
      despachar({ tipo: "denunciaEnviada", folio });
    } catch (causa) {
      setEtapa(null);
      setError(mensajeDeErrorEnvio(causa, { reintento }));
    }
  };

  const enviando = etapa !== null;
  const quizaYaLlego = error === MENSAJE_QUIZA_YA_LLEGO;
  const progreso = etapa && progresoEnvio(etapa);

  return (
    <div className="space-y-5">
      <p>Todo está listo. Al pulsar el botón pasará esto:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Tu relato se sella en este dispositivo. Solo la autoridad podrá abrirlo.</li>
        <li>Tu frase se queda aquí. Solo sale un código derivado de ella.</li>
        <li>Recibirás un folio. Guárdalo junto con tu frase.</li>
      </ul>

      {progreso && (
        <div>
          <p aria-hidden="true" className="text-sm text-tinta-suave">
            {`Paso ${progreso.actual} de ${progreso.total}`}
          </p>
          <progress
            aria-label="Avance del envío"
            className="mt-1 block w-full accent-marca"
            value={progreso.actual}
            max={progreso.total}
          />
        </div>
      )}
      <p role="status" className="font-medium">
        {etapa && mensajeEsperaEnvio(etapa, segundos)}
      </p>
      <div role="alert">
        {error && (
          <div className="border-l-4 border-peligro bg-peligro-suave p-4">
            <p>{error}</p>
            {quizaYaLlego && (
              <p className="mt-2">
                <Link prefetch={false} href="/seguimiento" className="underline">
                  Ir a Seguimiento y consultar con mi frase
                </Link>
              </p>
            )}
          </div>
        )}
      </div>

      <button type="button" className={BOTON_PRIMARIO} disabled={enviando} onClick={enviar}>
        {error ? "Intentar de nuevo" : "Enviar mi denuncia"}
      </button>
      {error && (
        <button
          type="button"
          className={`${BOTON_SECUNDARIO} ml-0 sm:ml-3`}
          onClick={() => despachar({ tipo: "volverA", paso: "revision" })}
        >
          Revisar otra vez
        </button>
      )}
    </div>
  );
}
