"use client";

import { ETAPAS, type Etapa } from "@dataton/shared";
import { useRef, useState } from "react";
import { cambiarEtapa, esSesionVencida, mensajeDeError } from "@/lib/autoridad/api";
import { admiteCambios, avisoDeConfirmacion, etapasDisponibles } from "@/lib/autoridad/tramite";
import { usePanel } from "./contexto";
import { ALERTA, BOTON_PRIMARIO, BOTON_SECUNDARIO } from "./estilos";

export function CambioEtapa(props: {
  denunciaId: string;
  etapa: Etapa;
  alCambiar: (destino: Etapa) => void;
}) {
  const { terminarSesion } = usePanel();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [destino, setDestino] = useState<Etapa | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!admiteCambios(props.etapa)) {
    return (
      <p className="text-sm text-tinta-suave">Esta etapa es terminal: no admite más cambios.</p>
    );
  }

  const pedirConfirmacion = (etapa: Etapa) => {
    setDestino(etapa);
    setError(null);
    dialogo.current?.showModal();
  };

  const confirmar = async () => {
    if (!destino) return;
    setEnviando(true);
    setError(null);
    try {
      await cambiarEtapa(props.denunciaId, destino);
      dialogo.current?.close();
      // Sin esto, al llegar la etapa nueva el aviso se calcularía de la etapa hacia sí misma.
      setDestino(null);
      props.alCambiar(destino);
    } catch (causa) {
      if (esSesionVencida(causa)) {
        terminarSesion();
        return;
      }
      setError(mensajeDeError(causa));
    }
    setEnviando(false);
  };

  return (
    <>
      <ul className="flex flex-col items-start gap-2">
        {etapasDisponibles(props.etapa).map(({ etapa, etiqueta }) => (
          <li key={etapa}>
            <button
              type="button"
              className={BOTON_SECUNDARIO}
              onClick={() => pedirConfirmacion(etapa)}
            >
              Pasar a: {etiqueta}
            </button>
          </li>
        ))}
      </ul>
      <dialog
        ref={dialogo}
        aria-labelledby="titulo-confirmar-etapa"
        onClose={() => setDestino(null)}
        onCancel={(e) => {
          if (enviando) e.preventDefault();
        }}
        className="m-auto w-full max-w-md rounded-sm border border-borde-fuerte bg-superficie p-5 text-tinta backdrop:bg-black/50"
      >
        <h2 id="titulo-confirmar-etapa" className="mb-2 text-base font-semibold">
          Confirmar cambio a {destino ? ETAPAS[destino].etiqueta : ""}
        </h2>
        <p className="mb-4 text-sm">{destino && avisoDeConfirmacion(props.etapa, destino)}</p>
        {error && (
          <p role="alert" className={`${ALERTA} mb-4`}>
            {error}
          </p>
        )}
        {/* Cancelar va primero para recibir el foco inicial: el cambio no se deshace. */}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className={BOTON_SECUNDARIO}
            disabled={enviando}
            onClick={() => dialogo.current?.close()}
          >
            Cancelar
          </button>
          <button type="button" className={BOTON_PRIMARIO} disabled={enviando} onClick={confirmar}>
            {enviando ? "Guardando…" : "Confirmar cambio"}
          </button>
        </div>
      </dialog>
    </>
  );
}
