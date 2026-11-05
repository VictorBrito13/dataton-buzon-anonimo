"use client";

import { useLayoutEffect, useRef } from "react";
import { Aviso, BOTON_SECUNDARIO } from "@/components/ui";
import {
  busquedaActiva,
  mensajeBusqueda,
  type EstadoBusqueda,
} from "@/lib/denuncia/busqueda-modelo";

const ID_AYUDA = "ayuda-busqueda-modelo";

/** El botón desaparece al terminar o cancelar: su foco pasa a otro lado antes de quitarlo. */
function BotonCancelar({
  alCancelar,
  alQuitarse,
}: {
  alCancelar: () => void;
  alQuitarse: () => void;
}) {
  const boton = useRef<HTMLButtonElement>(null);
  const aviso = useRef(alQuitarse);

  useLayoutEffect(() => {
    aviso.current = alQuitarse;
  });

  useLayoutEffect(() => {
    const elemento = boton.current;
    return () => {
      if (elemento && document.activeElement === elemento) aviso.current();
    };
  }, []);

  return (
    <button ref={boton} type="button" className={BOTON_SECUNDARIO} onClick={alCancelar}>
      Cancelar
    </button>
  );
}

export function OpcionModelo({
  busqueda,
  disponible,
  alActivar,
  alCancelar,
}: {
  busqueda: EstadoBusqueda;
  disponible: boolean;
  alActivar: () => void;
  alCancelar: () => void;
}) {
  const casilla = useRef<HTMLInputElement>(null);
  const mensaje = mensajeBusqueda(busqueda, disponible);
  const descargando = busqueda.fase === "cargando" && busqueda.porcentaje < 100;
  const preparando = busqueda.fase === "cargando" && busqueda.porcentaje >= 100;
  const enCurso = busqueda.fase === "cargando" || busqueda.fase === "analizando";
  const conProblema = !disponible || busqueda.fase === "fallo";

  return (
    <div className="mt-3 border border-borde bg-superficie p-4">
      <label className="flex min-h-11 items-start gap-3 font-semibold">
        <input
          ref={casilla}
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-marca"
          aria-describedby={ID_AYUDA}
          disabled={!disponible}
          checked={disponible && busquedaActiva(busqueda)}
          onChange={(e) => (e.target.checked ? alActivar() : alCancelar())}
        />
        Buscar también nombres, cargos y lugares
      </label>

      <ul id={ID_AYUDA} className="mt-2 list-disc space-y-1 pl-5">
        <li>Corre en tu dispositivo: nada de lo que revisa sale de él.</li>
        <li>
          La primera vez descarga unos 165 MB desde este mismo sitio. Con datos móviles puede tardar
          y consumir tu plan.
        </li>
        <li>Puede no detectarlo todo y puede equivocarse. Lo que marque son solo sugerencias.</li>
        <li>
          El modelo queda guardado en este navegador y la salida rápida no lo borra: quien revise
          este equipo podría notar que este sitio lo descargó.
        </li>
      </ul>

      {descargando && (
        <progress
          aria-label="Avance de la descarga del modelo"
          className="mt-3 block w-full accent-marca"
          max={100}
          value={busqueda.porcentaje}
        />
      )}
      {(preparando || busqueda.fase === "analizando") && (
        <progress aria-label="Preparando la búsqueda" className="mt-3 block w-full accent-marca" />
      )}

      {/* Siempre montada: una región viva solo anuncia cambios si ya existía. */}
      <div role="status" aria-live="polite" className="mt-3 empty:hidden">
        {mensaje &&
          (conProblema ? (
            <Aviso>
              <p>{mensaje}</p>
            </Aviso>
          ) : (
            <p>{mensaje}</p>
          ))}
      </div>

      {enCurso && (
        <div className="mt-3">
          <BotonCancelar alCancelar={alCancelar} alQuitarse={() => casilla.current?.focus()} />
        </div>
      )}
    </div>
  );
}
