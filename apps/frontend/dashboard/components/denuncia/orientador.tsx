"use client";

import { useState } from "react";
import { BOTON_SECUNDARIO, Aviso, idCampo } from "@/components/ui";
import {
  AVISO_ORIENTADOR,
  QUIENES,
  senalesDe,
  sugerirTipoFalta,
  type Quien,
} from "@/lib/denuncia/orientador";

const OPCION = "flex min-h-11 items-start gap-3 py-2";
const RADIO = "mt-1 size-5 shrink-0 accent-marca";

export function Orientador({
  tipoFaltaActual,
  alElegir,
}: {
  tipoFaltaActual: string;
  alElegir: (tipoFalta: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [quien, setQuien] = useState<Quien | null>(null);
  const [senal, setSenal] = useState<string | null>(null);
  const [elegida, setElegida] = useState<{ tipoFalta: string; etiqueta: string } | null>(null);
  const sugerencia = quien && senal ? sugerirTipoFalta(quien, senal) : null;

  const confirmada = elegida?.tipoFalta === tipoFaltaActual ? elegida : null;

  return (
    <>
      {/* Fuera del panel: lo que queda dentro de un details cerrado no se anuncia. */}
      <p role="status" aria-live="polite" className="mt-2 font-medium">
        {confirmada && `Elegimos «${confirmada.etiqueta}». Puedes cambiarla en esta lista.`}
      </p>
      <details
        open={abierto}
        onToggle={(e) => {
          const abriendo = e.currentTarget.open;
          setAbierto(abriendo);
          // Sin esto, volver a elegir lo mismo no cambiaría el texto y no se anunciaría.
          if (abriendo) setElegida(null);
        }}
        className="mt-1 border border-borde bg-superficie"
      >
        <summary className="flex min-h-11 cursor-pointer items-center px-3 py-2 font-medium text-marca underline">
          ¿No sabes cuál elegir? Te orientamos, sin palabras legales
        </summary>
        <div className="space-y-4 border-t border-borde p-3">
          <p>
            Esta ayuda funciona solo en tu dispositivo. Tus respuestas no se envían ni se guardan.
          </p>

          <fieldset>
            <legend className="font-semibold">¿Quién lo hizo?</legend>
            {QUIENES.map((opcion) => (
              <label key={opcion.clave} className={OPCION}>
                <input
                  type="radio"
                  name="orientador-quien"
                  className={RADIO}
                  checked={quien === opcion.clave}
                  onChange={() => {
                    setQuien(opcion.clave);
                    setSenal(null);
                  }}
                />
                <span>
                  {opcion.etiqueta}
                  <span className="block text-tinta-suave">{opcion.ayuda}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {quien && (
            <fieldset>
              <legend className="font-semibold">¿Qué se parece más a lo que pasó?</legend>
              {senalesDe(quien).map((opcion) => (
                <label key={opcion.clave} className={OPCION}>
                  <input
                    type="radio"
                    name="orientador-senal"
                    className={RADIO}
                    checked={senal === opcion.clave}
                    onChange={() => setSenal(opcion.clave)}
                  />
                  <span>
                    {opcion.etiqueta}
                    <span className="block text-tinta-suave">{opcion.ayuda}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          <div role="status">
            {sugerencia && (
              <div>
                <p>
                  Podría corresponder a: <strong>{sugerencia.etiqueta}</strong>
                </p>
                <button
                  type="button"
                  className={`${BOTON_SECUNDARIO} mt-2`}
                  onClick={() => {
                    alElegir(sugerencia.tipoFalta);
                    setElegida(sugerencia);
                    setAbierto(false);
                    document.getElementById(idCampo("tipoFalta"))?.focus();
                  }}
                >
                  Usar esta opción
                </button>
              </div>
            )}
          </div>

          <Aviso titulo="Es solo una orientación">
            <p>{AVISO_ORIENTADOR}</p>
          </Aviso>
        </div>
      </details>
    </>
  );
}
