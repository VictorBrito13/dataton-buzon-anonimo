"use client";

import { useRef } from "react";
import { BOTON_SECUNDARIO, CONTROL, Campo, ariaCampo } from "@/components/ui";
import type { EstadoAsistente } from "@/lib/denuncia/asistente";
import { MAX_PERSONAS } from "@/lib/denuncia/validaciones";
import type { Despachar } from "./asistente";

export function PasoPersonas({
  estado,
  despachar,
}: {
  estado: EstadoAsistente;
  despachar: Despachar;
}) {
  const { personas, errores } = estado;
  const botonAgregar = useRef<HTMLButtonElement>(null);
  const lleno = personas.length >= MAX_PERSONAS;

  return (
    <div className="space-y-5">
      <p>
        ¿Quiénes participaron? Este paso es opcional: si no lo sabes, continúa. Estos datos viajan
        sellados y solo los lee la autoridad. No te incluyas a ti.
      </p>

      {personas.map((persona, i) => {
        const nombreError = errores[`persona-${i}-nombre`];
        const cargoError = errores[`persona-${i}-cargo`];
        return (
          <fieldset key={i} className="space-y-3 border border-borde bg-superficie p-4">
            <legend className="px-1 font-semibold">{`Persona o ente ${i + 1}`}</legend>
            <Campo nombre={`persona-${i}-nombre`} etiqueta="Nombre" opcional error={nombreError}>
              <input
                {...ariaCampo(`persona-${i}-nombre`, nombreError)}
                // Se enfoca la fila recién agregada.
                autoFocus={i === personas.length - 1 && !persona.nombre && !persona.cargo}
                autoComplete="off"
                spellCheck={false}
                className={CONTROL}
                value={persona.nombre}
                onChange={(e) =>
                  despachar({
                    tipo: "editarPersona",
                    indice: i,
                    campo: "nombre",
                    valor: e.target.value,
                  })
                }
              />
            </Campo>
            <Campo
              nombre={`persona-${i}-cargo`}
              etiqueta="Cargo, área o cómo la reconoces"
              opcional
              error={cargoError}
            >
              <input
                {...ariaCampo(`persona-${i}-cargo`, cargoError)}
                autoComplete="off"
                spellCheck={false}
                className={CONTROL}
                value={persona.cargo}
                onChange={(e) =>
                  despachar({
                    tipo: "editarPersona",
                    indice: i,
                    campo: "cargo",
                    valor: e.target.value,
                  })
                }
              />
            </Campo>
            <button
              type="button"
              className={BOTON_SECUNDARIO}
              onClick={() => {
                despachar({ tipo: "quitarPersona", indice: i });
                botonAgregar.current?.focus();
              }}
            >
              {`Quitar persona o ente ${i + 1}`}
            </button>
          </fieldset>
        );
      })}

      <button
        ref={botonAgregar}
        type="button"
        className={BOTON_SECUNDARIO}
        disabled={lleno}
        onClick={() => despachar({ tipo: "agregarPersona" })}
      >
        Agregar una persona o ente
      </button>
      {lleno && <p>Llegaste al máximo de {MAX_PERSONAS}. Puedes mencionar más en tu relato.</p>}
    </div>
  );
}
