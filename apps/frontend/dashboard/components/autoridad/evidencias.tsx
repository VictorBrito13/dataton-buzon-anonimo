"use client";

import type { DetalleDenunciaAutoridad } from "@dataton/shared";
import { useState } from "react";
import { descargarEvidencia, esSesionVencida, mensajeDeError } from "@/lib/autoridad/api";
import { ErrorSello, abrirEvidencia, type EvidenciaAbierta } from "@/lib/autoridad/sellos";
import { usePanel } from "./contexto";
import { BOTON_SECUNDARIO, CELDA, CELDA_TITULO } from "./estilos";

const entregar = ({ nombre, archivo }: EvidenciaAbierta) => {
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  // El navegador necesita tiempo para empezar la descarga antes de soltar el blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function FilaEvidencia(props: {
  denunciaId: string;
  evidencia: DetalleDenunciaAutoridad["evidencias"][number];
}) {
  const { clave, terminarSesion } = usePanel();
  const [abriendo, setAbriendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const abrirYGuardar = async () => {
    if (!clave) return;
    setAbriendo(true);
    setAviso(null);
    try {
      const sello = await descargarEvidencia(props.denunciaId, props.evidencia.id);
      const abierta = await abrirEvidencia(clave, sello, props.evidencia);
      entregar(abierta);
      setAviso(`Abierta en este navegador y guardada como ${abierta.nombre}.`);
    } catch (causa) {
      if (esSesionVencida(causa)) {
        terminarSesion();
        return;
      }
      setAviso(causa instanceof ErrorSello ? causa.message : mensajeDeError(causa));
    }
    setAbriendo(false);
  };

  return (
    <tr>
      <td className={`${CELDA} font-mono`}>{props.evidencia.id.slice(0, 8)}</td>
      <td className={`${CELDA} break-words`}>{props.evidencia.tipo}</td>
      <td className={CELDA}>
        {clave ? (
          <button
            type="button"
            className={BOTON_SECUNDARIO}
            onClick={abrirYGuardar}
            disabled={abriendo}
            aria-label={`Descargar y abrir evidencia ${props.evidencia.id.slice(0, 8)}`}
          >
            {abriendo ? "Abriendo…" : "Descargar y abrir"}
          </button>
        ) : (
          <strong>Contenido sellado</strong>
        )}
        <p role="status" className="mt-1 text-xs">
          {aviso}
        </p>
      </td>
    </tr>
  );
}

export function Evidencias(props: {
  denunciaId: string;
  evidencias: DetalleDenunciaAutoridad["evidencias"];
}) {
  if (props.evidencias.length === 0) {
    return <p className="text-sm text-tinta-suave">Esta denuncia no tiene evidencias.</p>;
  }
  return (
    <div role="region" aria-label="Tabla de evidencias" tabIndex={0} className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Evidencias selladas de esta denuncia</caption>
        <thead>
          <tr>
            <th scope="col" className={CELDA_TITULO}>
              Evidencia
            </th>
            <th scope="col" className={CELDA_TITULO}>
              Tipo
            </th>
            <th scope="col" className={CELDA_TITULO}>
              Acción
            </th>
          </tr>
        </thead>
        <tbody>
          {props.evidencias.map((evidencia) => (
            <FilaEvidencia key={evidencia.id} denunciaId={props.denunciaId} evidencia={evidencia} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
