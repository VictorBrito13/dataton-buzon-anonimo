"use client";

import { generarFrase } from "@dataton/shared";
import { useEffect, useReducer, useRef, useState } from "react";
import { Anuncio, BOTON_PRIMARIO, BOTON_SECUNDARIO, ResumenErrores } from "@/components/ui";
import {
  estadoInicial,
  reducirAsistente,
  type AccionAsistente,
  type EstadoAsistente,
} from "@/lib/denuncia/asistente";
import { borrarBorrador, guardarBorrador, leerBorrador } from "@/lib/denuncia/borrador";
import { elegirPosiciones } from "@/lib/denuncia/frase";
import { PASOS, anuncioPaso, numeroPaso, tituloPaso } from "@/lib/denuncia/pasos";
import { almacenLocal } from "@/lib/infraestructura/navegador";
import { cancelarModeloNer } from "@/lib/privacidad";
import { PantallaFinal } from "./pantalla-final";
import { PasoEnvio, adelantarEnvio } from "./paso-envio";
import { PasoEvidencias } from "./paso-evidencias";
import { PasoFrase } from "./paso-frase";
import { PasoHechos } from "./paso-hechos";
import { PasoPersonas } from "./paso-personas";
import { PasoRevision } from "./paso-revision";

export type Despachar = (accion: AccionAsistente) => void;

const ETIQUETAS_ERROR: Record<string, string> = {
  estado: "Estado",
  municipio: "Municipio",
  tipoFalta: "Tipo de falta",
  cuando: "Cuándo pasó",
  relato: "Relato",
};

function Progreso({ estado }: { estado: EstadoAsistente }) {
  const actual = numeroPaso(estado.paso);
  return (
    <nav aria-label="Progreso" className="mt-4">
      <p className="font-semibold">{`Paso ${actual} de ${PASOS.length}`}</p>
      <ol className="mt-2 flex gap-1">
        {PASOS.map((paso, i) => (
          <li
            key={paso.clave}
            aria-current={paso.clave === estado.paso ? "step" : undefined}
            className={`h-2 flex-1 ${i < actual ? "bg-marca" : "border border-borde-fuerte"}`}
          >
            <span className="sr-only">
              {`${paso.titulo}${i < actual - 1 ? ", completado" : ""}`}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Asistente({ modeloDisponible }: { modeloDisponible: boolean }) {
  const [estado, despachar] = useReducer(reducirAsistente, undefined, estadoInicial);
  const [borradorGuardado, setBorradorGuardado] = useState(() => leerBorrador(almacenLocal()));
  const [intento, setIntento] = useState(0);
  const titulo = useRef<HTMLHeadingElement>(null);
  const primerRender = useRef(true);

  const { paso, hechos, personas, guardarBorrador: guardarActivo, folio } = estado;

  // El foco acompaña al cambio de paso, para teclado y lectores de pantalla.
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    titulo.current?.focus();
    window.scrollTo({ top: 0 });
  }, [paso]);

  useEffect(() => {
    if (guardarActivo) guardarBorrador(almacenLocal(), { hechos, personas });
  }, [guardarActivo, hechos, personas]);

  useEffect(() => {
    if (paso === "frase") adelantarEnvio();
  }, [paso]);

  // Al enviar se libera el modelo: el reductor vuelve a apagar la opción.
  useEffect(() => {
    if (!folio) return;
    borrarBorrador(almacenLocal());
    cancelarModeloNer();
  }, [folio]);

  // El modelo vive fuera de React: si sobreviviera, una denuncia nueva lo usaría con la opción apagada.
  useEffect(() => cancelarModeloNer, []);

  if (folio) return <PantallaFinal folio={folio} />;

  const avanzar = () => {
    setIntento((i) => i + 1);
    despachar({ tipo: "avanzar" });
    // La frase nace aquí, en el dispositivo; el reductor la ignora si ya existe.
    if (paso === "revision") {
      despachar({
        tipo: "fraseGenerada",
        frase: generarFrase(),
        posiciones: elegirPosiciones(),
      });
    }
  };

  const cambiarGuardado = (activo: boolean) => {
    despachar({ tipo: "cambiarGuardado", activo });
    if (!activo) {
      borrarBorrador(almacenLocal());
      setBorradorGuardado(null);
    }
  };

  const hayErrores = Object.keys(estado.errores).length > 0;

  return (
    <div>
      <Progreso estado={estado} />
      <Anuncio>{anuncioPaso(paso)}</Anuncio>

      {borradorGuardado && (
        <div className="mt-6 border-l-4 border-aviso bg-aviso-suave p-4">
          <p className="font-semibold">Hay un borrador guardado en este dispositivo.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              className={BOTON_SECUNDARIO}
              onClick={() => {
                despachar({ tipo: "restaurarBorrador", borrador: borradorGuardado });
                setBorradorGuardado(null);
              }}
            >
              Continuar con el borrador
            </button>
            <button
              type="button"
              className={BOTON_SECUNDARIO}
              onClick={() => {
                borrarBorrador(almacenLocal());
                setBorradorGuardado(null);
              }}
            >
              Borrarlo
            </button>
          </div>
        </div>
      )}

      <h2 ref={titulo} tabIndex={-1} className="mt-6 text-2xl font-semibold">
        {tituloPaso(paso)}
      </h2>

      <form
        noValidate
        className="mt-4"
        onSubmit={(evento) => {
          evento.preventDefault();
          if (paso !== "envio") avanzar();
        }}
      >
        {hayErrores && paso !== "frase" && (
          <ResumenErrores key={intento} errores={estado.errores} etiquetas={ETIQUETAS_ERROR} />
        )}

        {paso === "hechos" && (
          <PasoHechos estado={estado} despachar={despachar} cambiarGuardado={cambiarGuardado} />
        )}
        {paso === "personas" && <PasoPersonas estado={estado} despachar={despachar} />}
        {paso === "evidencias" && <PasoEvidencias estado={estado} despachar={despachar} />}
        {paso === "revision" && (
          <PasoRevision estado={estado} despachar={despachar} modeloDisponible={modeloDisponible} />
        )}
        {paso === "frase" && <PasoFrase estado={estado} despachar={despachar} avanzar={avanzar} />}
        {paso === "envio" && <PasoEnvio estado={estado} despachar={despachar} />}

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-borde pt-5 sm:flex-row sm:justify-between">
          {paso !== "hechos" ? (
            <button
              type="button"
              className={BOTON_SECUNDARIO}
              onClick={() => despachar({ tipo: "retroceder" })}
            >
              Atrás
            </button>
          ) : (
            <span />
          )}
          {paso !== "frase" && paso !== "envio" && (
            <button type="submit" className={BOTON_PRIMARIO}>
              Continuar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
