"use client";

import { ESTADOS, TIPOS_FALTA } from "@dataton/shared";
import { useState } from "react";
import { Aviso, CONTROL, Campo, MensajeError, ariaCampo, idCampo } from "@/components/ui";
import type { EstadoAsistente } from "@/lib/denuncia/asistente";
import { municipiosDeEstado } from "@/lib/denuncia/catalogos-locales";
import { MESES, NO_RECUERDO } from "@/lib/denuncia/relato";
import { MAX_RELATO } from "@/lib/denuncia/validaciones";
import type { Despachar } from "./asistente";
import { BuscadorEnte } from "./buscador-ente";
import { useMunicipios } from "./catalogos";
import { Orientador } from "./orientador";

const ANIOS_ATRAS = 15;

const estadosOrdenados = Object.entries(ESTADOS).sort(([, a], [, b]) => a.localeCompare(b, "es"));

function Cuando({
  valor,
  error,
  alCambiar,
}: {
  valor: string;
  error?: string;
  alCambiar: (valor: string) => void;
}) {
  const [anioActual] = useState(() => new Date().getFullYear());
  const noRecuerda = valor === NO_RECUERDO;
  const [anio = "", mes = ""] = noRecuerda ? [] : valor.split("-");
  const anios = Array.from({ length: ANIOS_ATRAS + 1 }, (_, i) => String(anioActual - i));
  const componer = (a: string, m: string) => (a || m ? `${a}-${m}` : "");

  return (
    <fieldset
      id={idCampo("cuando")}
      tabIndex={-1}
      aria-describedby={`${idCampo("cuando")}-ayuda${error ? ` ${idCampo("cuando")}-error` : ""}`}
    >
      <legend className="font-semibold">¿Cuándo pasó, aproximadamente?</legend>
      <p id={`${idCampo("cuando")}-ayuda`} className="mb-2 text-tinta-suave">
        Solo pedimos mes y año porque una fecha exacta podría identificarte: quizá pocas personas
        estuvieron ahí ese día. Este dato viaja sellado, junto con tu relato.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="campo-cuando-mes">Mes</label>
          <select
            id="campo-cuando-mes"
            className={CONTROL}
            disabled={noRecuerda}
            value={mes}
            onChange={(e) => alCambiar(componer(anio, e.target.value))}
          >
            <option value="">Elige</option>
            {MESES.map((nombre, i) => (
              <option key={nombre} value={String(i + 1).padStart(2, "0")}>
                {nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="campo-cuando-anio">Año</label>
          <select
            id="campo-cuando-anio"
            className={CONTROL}
            disabled={noRecuerda}
            value={anio}
            onChange={(e) => alCambiar(componer(e.target.value, mes))}
          >
            <option value="">Elige</option>
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className="mt-2 flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          className="size-5 shrink-0 accent-marca"
          checked={noRecuerda}
          onChange={(e) => alCambiar(e.target.checked ? NO_RECUERDO : "")}
        />
        No lo recuerdo
      </label>
      {error && <MensajeError id={`${idCampo("cuando")}-error`}>{error}</MensajeError>}
    </fieldset>
  );
}

export function PasoHechos({
  estado,
  despachar,
  cambiarGuardado,
}: {
  estado: EstadoAsistente;
  despachar: Despachar;
  cambiarGuardado: (activo: boolean) => void;
}) {
  const { hechos, errores, guardarBorrador } = estado;
  const { datos: catalogo, fallo } = useMunicipios();
  const municipios = catalogo ? municipiosDeEstado(catalogo, hechos.estado) : [];
  const campo = (nombre: "estado" | "municipio" | "tipoFalta" | "relato", valor: string) =>
    despachar({ tipo: "campoHecho", campo: nombre, valor });

  return (
    <div className="space-y-6">
      <p>
        Responde lo que sepas. Lo marcado como opcional lo puedes dejar en blanco. Nada se envía
        hasta el último paso.
      </p>

      <Campo nombre="estado" etiqueta="¿En qué estado pasó?" error={errores.estado}>
        <select
          {...ariaCampo("estado", errores.estado)}
          className={CONTROL}
          value={hechos.estado}
          onChange={(e) => campo("estado", e.target.value)}
        >
          <option value="">Elige un estado</option>
          {estadosOrdenados.map(([clave, nombre]) => (
            <option key={clave} value={clave}>
              {nombre}
            </option>
          ))}
        </select>
      </Campo>

      <Campo
        nombre="municipio"
        etiqueta="¿En qué municipio?"
        opcional
        ayuda={
          fallo
            ? "No pudimos cargar la lista de municipios. Puedes seguir sin elegirlo."
            : "En un municipio pequeño es más fácil que te identifiquen. Si te preocupa, déjalo en blanco."
        }
        error={errores.municipio}
      >
        <select
          {...ariaCampo("municipio", errores.municipio, true)}
          className={CONTROL}
          disabled={!hechos.estado || municipios.length === 0}
          value={hechos.municipio}
          onChange={(e) => campo("municipio", e.target.value)}
        >
          <option value="">
            {hechos.estado ? "Prefiero no decirlo" : "Primero elige el estado"}
          </option>
          {municipios.map(({ clave, nombre }) => (
            <option key={clave} value={clave}>
              {nombre}
            </option>
          ))}
        </select>
      </Campo>

      <div>
        <Campo nombre="tipoFalta" etiqueta="¿Qué tipo de falta es?" error={errores.tipoFalta}>
          <select
            {...ariaCampo("tipoFalta", errores.tipoFalta)}
            className={CONTROL}
            value={hechos.tipoFalta}
            onChange={(e) => campo("tipoFalta", e.target.value)}
          >
            <option value="">Elige una opción</option>
            {Object.entries(TIPOS_FALTA).map(([clave, { etiqueta }]) => (
              <option key={clave} value={clave}>
                {etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Orientador
          tipoFaltaActual={hechos.tipoFalta}
          alElegir={(tipo) => campo("tipoFalta", tipo)}
        />
      </div>

      <BuscadorEnte
        enteId={hechos.enteId}
        estado={hechos.estado}
        alCambiar={(enteId) => despachar({ tipo: "campoHecho", campo: "enteId", valor: enteId })}
      />

      <Cuando
        valor={hechos.cuando}
        error={errores.cuando}
        alCambiar={(valor) => despachar({ tipo: "campoHecho", campo: "cuando", valor })}
      />

      <Campo
        nombre="relato"
        etiqueta="Cuéntanos qué pasó"
        ayuda="Qué viste, dónde y quién participó. No escribas tu nombre ni cómo te enteraste, si eso puede identificarte. En el paso de revisión te ayudamos a buscar esos datos."
        error={errores.relato}
      >
        <textarea
          {...ariaCampo("relato", errores.relato, true)}
          rows={8}
          maxLength={MAX_RELATO}
          // El corrector mejorado de algunos navegadores envía el texto a terceros.
          spellCheck={false}
          autoComplete="off"
          className={CONTROL}
          value={hechos.relato}
          onChange={(e) => campo("relato", e.target.value)}
        />
      </Campo>

      <div className="border border-borde bg-superficie p-4">
        <label className="flex min-h-11 items-start gap-3 font-semibold">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0 accent-marca"
            checked={guardarBorrador}
            onChange={(e) => cambiarGuardado(e.target.checked)}
          />
          Guardar un borrador en este dispositivo
        </label>
        <div className="mt-2">
          <Aviso titulo="Antes de activarlo">
            <p>
              Tu texto queda sin sellar en este navegador hasta que envíes o uses la salida rápida.
              No lo actives en un equipo compartido o del trabajo. Nunca se envía a ningún lado.
            </p>
          </Aviso>
        </div>
      </div>
    </div>
  );
}
