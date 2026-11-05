"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Anuncio, BOTON_SECUNDARIO, CONTROL, Campo, idCampo } from "@/components/ui";
import { buscarEntes, debeCargarEntes, nombreEnte } from "@/lib/denuncia/catalogos-locales";
import { useEntes } from "./catalogos";

/** Búsqueda local sobre el catálogo del S5: lo que se escribe aquí nunca llega a la red. */
export function BuscadorEnte({
  enteId,
  estado,
  alCambiar,
}: {
  enteId: string;
  estado: string;
  alCambiar: (enteId: string) => void;
}) {
  const [consulta, setConsulta] = useState("");
  const { datos: entes, fallo } = useEntes(debeCargarEntes(consulta, enteId));
  const diferida = useDeferredValue(consulta);
  const resultados = useMemo(
    () => (entes ? buscarEntes(entes, diferida, estado) : []),
    [entes, diferida, estado],
  );

  if (enteId) {
    const nombre = entes ? nombreEnte(entes, enteId) : null;
    return (
      <div>
        <p className="font-semibold">Institución involucrada</p>
        <p className="mt-1">{nombre ?? "Institución elegida"}</p>
        <button
          type="button"
          className={`${BOTON_SECUNDARIO} mt-2`}
          onClick={() => {
            alCambiar("");
            setConsulta("");
          }}
        >
          Quitar esta institución
        </button>
      </div>
    );
  }

  const buscando = consulta.trim().length >= 3;
  let estadoBusqueda = "";
  if (fallo) estadoBusqueda = "No pudimos cargar la lista. Puedes seguir sin elegir institución.";
  else if (consulta.trim() && !entes) estadoBusqueda = "Cargando la lista de instituciones…";
  else if (buscando && entes) {
    estadoBusqueda =
      resultados.length === 0
        ? "No encontramos esa institución. Puedes mencionarla en tu relato."
        : `${resultados.length} resultados.`;
  }

  return (
    <Campo
      nombre="ente"
      etiqueta="Institución involucrada"
      opcional
      ayuda="Si no la recuerdas, déjalo en blanco. La búsqueda ocurre en tu dispositivo; lo que escribes no se envía. Solo la institución que elijas se usa, sin sellar, en conteos públicos agrupados."
    >
      <input
        id={idCampo("ente")}
        aria-describedby={`${idCampo("ente")}-ayuda`}
        type="search"
        autoComplete="off"
        spellCheck={false}
        className={CONTROL}
        value={consulta}
        placeholder="Escribe al menos 3 letras"
        onChange={(evento) => setConsulta(evento.target.value)}
        onKeyDown={(evento) => {
          // Enter dentro de la búsqueda no debe avanzar de paso.
          if (evento.key === "Enter") evento.preventDefault();
        }}
      />
      {estadoBusqueda && <p className="mt-1 text-tinta-suave">{estadoBusqueda}</p>}
      <Anuncio>{estadoBusqueda}</Anuncio>
      {buscando && resultados.length > 0 && (
        <ul aria-label="Instituciones encontradas" className="mt-2 border border-borde">
          {resultados.map((ente) => (
            <li key={ente.id} className="border-b border-borde last:border-b-0">
              <button
                type="button"
                className="min-h-11 w-full bg-superficie px-3 py-2 text-left hover:bg-marca-suave"
                onClick={() => alCambiar(String(ente.id))}
              >
                {ente.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Campo>
  );
}
