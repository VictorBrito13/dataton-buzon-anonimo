"use client";

import { useState } from "react";
import { BOTON_SECUNDARIO, Aviso } from "@/components/ui";
import {
  AVISO_ORIENTADOR,
  QUIENES,
  senalesDe,
  sugerirTipoFalta,
  type Quien,
} from "@/lib/denuncia/orientador";

const OPCION = "flex min-h-11 items-start gap-3 py-2";
const RADIO = "mt-1 size-5 shrink-0 accent-marca";

export function Orientador({ alElegir }: { alElegir: (tipoFalta: string) => void }) {
  const [quien, setQuien] = useState<Quien | null>(null);
  const [senal, setSenal] = useState<string | null>(null);
  const [aplicada, setAplicada] = useState(false);
  const sugerencia = quien && senal ? sugerirTipoFalta(quien, senal) : null;

  return (
    <details className="mt-3 border border-borde bg-superficie">
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
                  setAplicada(false);
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
                  onChange={() => {
                    setSenal(opcion.clave);
                    setAplicada(false);
                  }}
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
                  setAplicada(true);
                }}
              >
                Usar esta opción
              </button>
              {aplicada && <p className="mt-2 font-medium">Listo, ya la elegimos arriba.</p>}
            </div>
          )}
        </div>

        <Aviso titulo="Es solo una orientación">
          <p>{AVISO_ORIENTADOR}</p>
        </Aviso>
      </div>
    </details>
  );
}
