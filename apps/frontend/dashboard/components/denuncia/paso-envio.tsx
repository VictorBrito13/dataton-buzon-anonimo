"use client";

import { sellar } from "@dataton/shared";
import Link from "next/link";
import { useState } from "react";
import { BOTON_PRIMARIO, BOTON_SECUNDARIO } from "@/components/ui";
import type { EstadoAsistente } from "@/lib/denuncia/asistente";
import {
  DESCRIPCION_ETAPA_ENVIO,
  enviarDenuncia,
  type EtapaEnvio,
} from "@/lib/denuncia/enviar-denuncia";
import { MENSAJE_QUIZA_YA_LLEGO, mensajeDeErrorEnvio } from "@/lib/denuncia/errores";
import { buzonHttp } from "@/lib/infraestructura/buzon-http";
import { trabajoEnWorker } from "@/lib/infraestructura/trabajo";
import type { Despachar } from "./asistente";

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

  const enviar = async () => {
    if (!estado.frase) return;
    setError(null);
    // Un reintento tras perder la respuesta repite la misma frase: un 409 ahí casi siempre
    // significa que la denuncia sí llegó. El servidor no cambia; solo cambia cómo se explica.
    const reintento = intentos > 0;
    setIntentos(intentos + 1);
    try {
      const folio = await enviarDenuncia(
        {
          hechos: estado.hechos,
          personas: estado.personas,
          frase: estado.frase,
          evidenciaIds: estado.evidencias.map((e) => e.evidenciaId),
        },
        { buzon: buzonHttp, trabajo: trabajoEnWorker, sellar },
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

  return (
    <div className="space-y-5">
      <p>Todo está listo. Al pulsar el botón pasará esto:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Tu relato se sella en este dispositivo. Solo la autoridad podrá abrirlo.</li>
        <li>Tu frase se queda aquí. Solo sale un código derivado de ella.</li>
        <li>Recibirás un folio. Guárdalo junto con tu frase.</li>
      </ul>

      <p role="status" className="font-medium">
        {etapa && DESCRIPCION_ETAPA_ENVIO[etapa]}
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
