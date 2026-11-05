"use client";

import { useEffect, useRef, useState } from "react";
import { Anuncio, Aviso, BOTON_SECUNDARIO } from "@/components/ui";
import type { EstadoAsistente } from "@/lib/denuncia/asistente";
import {
  esSugerenciaDelModelo,
  modeloActivoEnRevision,
  resumenHallazgos,
} from "@/lib/denuncia/busqueda-modelo";
import { segmentarTexto, sugerenciaEnContexto } from "@/lib/denuncia/depuracion";
import {
  cancelarModeloNer,
  cargarModeloNer,
  escanearTexto,
  estadoModeloNer,
  type Hallazgo,
} from "@/lib/privacidad";
import type { Despachar } from "./asistente";
import { OpcionModelo } from "./opcion-modelo";
import { ResumenDenuncia } from "./resumen-denuncia";

export function PasoRevision({
  estado,
  despachar,
  modeloDisponible,
}: {
  estado: EstadoAsistente;
  despachar: Despachar;
  modeloDisponible: boolean;
}) {
  const { hechos, hallazgos, busquedaModelo } = estado;
  const relato = hechos.relato;
  const conModelo = modeloActivoEnRevision(busquedaModelo);
  const [fallo, setFallo] = useState(false);
  const [anuncio, setAnuncio] = useState("");
  const tituloHallazgos = useRef<HTMLHeadingElement>(null);

  // El análisis ocurre en el dispositivo; el texto no sale de aquí. `conModelo` descarta una
  // revisión en curso que empezó antes de que el modelo entrara o saliera.
  useEffect(() => {
    if (hallazgos !== null) return;
    let vigente = true;
    escanearTexto(relato).then(
      (encontrados) => {
        if (!vigente) return;
        despachar({ tipo: "hallazgosDetectados", hallazgos: encontrados });
        // Si el modelo falla, escanearTexto sigue con reglas sin avisar.
        despachar({
          tipo: "busquedaModelo",
          evento: { tipo: "revisionTerminada", modeloListo: estadoModeloNer() === "listo" },
        });
      },
      () => {
        if (!vigente) return;
        setFallo(true);
        despachar({ tipo: "hallazgosDetectados", hallazgos: [] });
        despachar({
          tipo: "busquedaModelo",
          evento: { tipo: "revisionTerminada", modeloListo: false },
        });
      },
    );
    return () => {
      vigente = false;
    };
  }, [hallazgos, relato, conModelo, despachar]);

  // La carga vive en el asistente: sigue si la persona va a otro paso, y nunca detiene el envío.
  const activarBusqueda = () => {
    despachar({ tipo: "busquedaModelo", evento: { tipo: "activar" } });
    void cargarModeloNer(({ porcentaje }) =>
      despachar({ tipo: "busquedaModelo", evento: { tipo: "progreso", porcentaje } }),
    ).then((exito) =>
      despachar({ tipo: "busquedaModelo", evento: { tipo: "cargaTerminada", exito } }),
    );
  };

  const cancelarBusqueda = () => {
    cancelarModeloNer();
    despachar({ tipo: "busquedaModelo", evento: { tipo: "cancelar" } });
  };

  const lista = hallazgos ?? [];
  const numeros = new Map(lista.map((h, i) => [h, i + 1]));

  const decidir = (hallazgo: Hallazgo, accion: "aplicarSugerencia" | "ignorarHallazgo") => {
    despachar({ tipo: accion, hallazgo });
    setAnuncio(
      accion === "aplicarSugerencia"
        ? `Reemplazado por ${sugerenciaEnContexto(relato, hallazgo)}.`
        : "Lo dejamos como está.",
    );
    // El botón pulsado desaparece: el foco no debe perderse.
    tituloHallazgos.current?.focus();
  };

  return (
    <div className="space-y-6">
      <p>Esto es lo que se enviará. Revísalo con calma; si algo no está bien, puedes cambiarlo.</p>
      <Anuncio>{anuncio}</Anuncio>

      <section aria-labelledby="titulo-relato">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="titulo-relato" className="font-semibold">
            Tu relato (sellado)
          </h3>
          <button
            type="button"
            className={BOTON_SECUNDARIO}
            onClick={() => despachar({ tipo: "volverA", paso: "hechos" })}
          >
            Cambiar el relato
          </button>
        </div>
        <p className="mt-2 border border-borde bg-superficie p-4 break-words whitespace-pre-wrap">
          {segmentarTexto(relato, lista).map((segmento, i) =>
            segmento.hallazgo ? (
              <mark
                key={i}
                className="rounded-sm border-b-2 border-aviso bg-aviso-suave px-0.5 text-tinta"
              >
                {segmento.texto}
                <sup className="ml-0.5 font-bold">{`[${numeros.get(segmento.hallazgo)}]`}</sup>
              </mark>
            ) : (
              <span key={i}>{segmento.texto}</span>
            ),
          )}
        </p>
      </section>

      <section aria-labelledby="titulo-hallazgos">
        <h3 id="titulo-hallazgos" ref={tituloHallazgos} tabIndex={-1} className="font-semibold">
          Datos que podrían identificarte
        </h3>
        <div role="status" className="mt-2">
          {hallazgos === null && <p>Revisando tu texto en este dispositivo…</p>}
          {fallo && (
            <Aviso>
              <p>No pudimos revisar tu texto. Léelo tú y quita lo que pueda identificarte.</p>
            </Aviso>
          )}
          {hallazgos !== null && !fallo && lista.length === 0 && (
            <p>
              No detectamos más datos de este tipo. Aun así, léelo una vez más: ninguna herramienta
              lo encuentra todo.
            </p>
          )}
          {lista.length > 0 && <p>{resumenHallazgos(lista)}</p>}
        </div>
        <OpcionModelo
          busqueda={busquedaModelo}
          disponible={modeloDisponible}
          alActivar={activarBusqueda}
          alCancelar={cancelarBusqueda}
        />
        {lista.length > 0 && (
          <ol className="mt-3 space-y-3">
            {lista.map((hallazgo) => (
              <li
                key={`${hallazgo.inicio}-${hallazgo.tipo}`}
                className="border border-borde bg-superficie p-4"
              >
                <p className="font-medium break-words">
                  {`[${numeros.get(hallazgo)}] «${hallazgo.texto}»`}
                </p>
                {esSugerenciaDelModelo(hallazgo) && (
                  <p className="mt-1 font-semibold">
                    Sugerencia automática: puede equivocarse. Tú decides.
                  </p>
                )}
                <p className="mt-1">{hallazgo.explicacion}</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    className={BOTON_SECUNDARIO}
                    onClick={() => decidir(hallazgo, "aplicarSugerencia")}
                  >
                    {`Reemplazar por ${sugerenciaEnContexto(relato, hallazgo)}`}
                  </button>
                  <button
                    type="button"
                    className={BOTON_SECUNDARIO}
                    onClick={() => decidir(hallazgo, "ignorarHallazgo")}
                  >
                    Dejarlo así
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="titulo-resumen">
        <h3 id="titulo-resumen" className="font-semibold">
          El resto de tu denuncia
        </h3>
        <ResumenDenuncia estado={estado} />
      </section>
    </div>
  );
}
