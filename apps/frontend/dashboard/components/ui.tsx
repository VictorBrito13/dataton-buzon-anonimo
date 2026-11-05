"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Clases compartidas: objetivos táctiles de 44 px y contraste de los tokens. */
export const BOTON_PRIMARIO =
  "inline-flex min-h-11 items-center justify-center rounded-sm bg-marca px-5 py-2 font-semibold text-marca-tinta no-underline hover:underline disabled:cursor-not-allowed disabled:opacity-60";
export const BOTON_SECUNDARIO =
  "inline-flex min-h-11 items-center justify-center rounded-sm border border-borde-fuerte bg-superficie px-4 py-2 font-medium text-tinta no-underline hover:bg-marca-suave disabled:cursor-not-allowed disabled:opacity-60";
export const CONTROL =
  "block min-h-11 w-full rounded-sm border border-borde-fuerte bg-superficie px-3 py-2 text-tinta aria-[invalid=true]:border-2 aria-[invalid=true]:border-peligro";

export const idCampo = (nombre: string) => `campo-${nombre}`;

/** Atributos que asocian un control con su ayuda y su error para los lectores de pantalla. */
export const ariaCampo = (nombre: string, error?: string, ayuda?: boolean) => ({
  id: idCampo(nombre),
  "aria-invalid": error ? true : undefined,
  "aria-describedby":
    [ayuda ? `${idCampo(nombre)}-ayuda` : "", error ? `${idCampo(nombre)}-error` : ""]
      .filter(Boolean)
      .join(" ") || undefined,
});

export function MensajeError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1 font-medium text-peligro">
      <span aria-hidden="true">✕ </span>
      {children}
    </p>
  );
}

export function Campo({
  nombre,
  etiqueta,
  opcional,
  ayuda,
  error,
  children,
}: {
  nombre: string;
  etiqueta: string;
  opcional?: boolean;
  ayuda?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={idCampo(nombre)} className="block font-semibold">
        {etiqueta}
        {opcional && <span className="font-normal text-tinta-suave"> (opcional)</span>}
      </label>
      {ayuda && (
        <p id={`${idCampo(nombre)}-ayuda`} className="mb-1 text-tinta-suave">
          {ayuda}
        </p>
      )}
      {children}
      {error && <MensajeError id={`${idCampo(nombre)}-error`}>{error}</MensajeError>}
    </div>
  );
}

/** Recibe el foco al aparecer, y enlaza a cada campo con error. */
export function ResumenErrores({
  errores,
  etiquetas,
}: {
  errores: Record<string, string>;
  etiquetas?: Record<string, string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const lista = Object.entries(errores);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="mb-6 border-l-4 border-peligro bg-peligro-suave p-4"
    >
      <p className="font-semibold">
        {lista.length === 1 ? "Falta corregir 1 dato:" : `Falta corregir ${lista.length} datos:`}
      </p>
      <ul className="mt-1 list-disc pl-5">
        {lista.map(([campo, mensaje]) => (
          <li key={campo}>
            <a href={`#${idCampo(campo)}`} className="inline-flex min-h-11 items-center underline">
              {etiquetas?.[campo] ? `${etiquetas[campo]}: ${mensaje}` : mensaje}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Aviso({
  tono = "aviso",
  titulo,
  children,
}: {
  tono?: "aviso" | "peligro" | "exito" | "marca";
  titulo?: string;
  children: ReactNode;
}) {
  const clases = {
    aviso: "border-aviso bg-aviso-suave",
    peligro: "border-peligro bg-peligro-suave",
    exito: "border-exito bg-exito-suave",
    marca: "border-marca bg-marca-suave",
  }[tono];
  return (
    <div className={`border-l-4 p-4 ${clases}`}>
      {titulo && <p className="font-semibold">{titulo}</p>}
      {children}
    </div>
  );
}

/** Región viva invisible, para cambios que no mueven el foco. */
export function Anuncio({ children }: { children: ReactNode }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {children}
    </p>
  );
}
