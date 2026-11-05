"use client";

import type { DetalleDenunciaAutoridad } from "@dataton/shared";
import { useState, type FormEvent } from "react";
import { esSesionVencida, mensajeDeError, responder } from "@/lib/autoridad/api";
import { ContenidoSellado } from "./contenido-sellado";
import { usePanel } from "./contexto";
import { ALERTA, BOTON_PRIMARIO, CAMPO, ETIQUETA } from "./estilos";

const MAX_CARACTERES = 5000;

export function Mensajes(props: {
  denunciaId: string;
  mensajes: DetalleDenunciaAutoridad["mensajes"];
  alEnviar: () => void;
}) {
  const { terminarSesion } = usePanel();
  const [cuerpo, setCuerpo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!cuerpo.trim()) {
      setError("Escribe un mensaje antes de enviarlo.");
      return;
    }
    setEnviando(true);
    setError(null);
    setAviso("");
    try {
      await responder(props.denunciaId, cuerpo);
      setCuerpo("");
      setAviso("Mensaje enviado.");
      props.alEnviar();
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
    <div className="space-y-4">
      {props.mensajes.length === 0 ? (
        <p className="text-sm text-tinta-suave">Todavía no hay mensajes.</p>
      ) : (
        <ol className="space-y-3">
          {props.mensajes.map((mensaje, indice) => (
            <li key={indice} className="border-l-2 border-borde-fuerte pl-3">
              <p className="mb-1 text-xs text-tinta-suave">
                <strong>{mensaje.autor === "autoridad" ? "Autoridad" : "Quien denuncia"}</strong>
                {" · "}
                <time dateTime={mensaje.dia}>{mensaje.dia}</time>
              </p>
              {mensaje.cuerpoSellado ? (
                <ContenidoSellado sello={mensaje.cuerpoSellado} />
              ) : (
                <p className="text-sm break-words whitespace-pre-wrap">{mensaje.cuerpo}</p>
              )}
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={enviar} className="space-y-2">
        <label htmlFor="respuesta" className={ETIQUETA}>
          Responder a quien denuncia
        </label>
        <p id="ayuda-respuesta" className="text-xs text-tinta-suave">
          Tu respuesta no va sellada: se guarda cifrada con la clave del servidor para que quien
          denunció pueda leerla. No pidas datos que la identifiquen.
        </p>
        <textarea
          id="respuesta"
          rows={3}
          maxLength={MAX_CARACTERES}
          aria-describedby="ayuda-respuesta"
          className={CAMPO}
          value={cuerpo}
          onChange={(e) => setCuerpo(e.target.value)}
        />
        {error && (
          <p role="alert" className={ALERTA}>
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button type="submit" className={BOTON_PRIMARIO} disabled={enviando}>
            {enviando ? "Enviando…" : "Enviar respuesta"}
          </button>
          <p role="status" className="text-sm text-exito">
            {aviso}
          </p>
        </div>
      </form>
    </div>
  );
}
