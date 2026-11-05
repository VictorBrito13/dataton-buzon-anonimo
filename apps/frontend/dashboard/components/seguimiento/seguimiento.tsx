"use client";

import type { Credencial, RespuestaConsulta } from "@dataton/shared";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useSegundosEspera } from "@/components/denuncia/use-segundos-espera";
import {
  Aviso,
  BOTON_PRIMARIO,
  BOTON_SECUNDARIO,
  CONTROL,
  Campo,
  ariaCampo,
} from "@/components/ui";
import { MENSAJE_SIN_CONEXION, mensajeDeError } from "@/lib/denuncia/errores";
import { mensajeEsperaConsulta } from "@/lib/denuncia/espera-envio";
import { buzonHttp } from "@/lib/infraestructura/buzon-http";
import { prepararTrabajador, trabajoEnWorker } from "@/lib/infraestructura/trabajo";
import { MAX_MENSAJE } from "@/lib/seguimiento/limites";
import { construirLineaTiempo, describirMensajes } from "@/lib/seguimiento/linea-tiempo";
import { pestanaPorTecla } from "@/lib/seguimiento/pestanas";

const PESTANAS = ["folio", "frase"] as const;
type Pestana = (typeof PESTANAS)[number];
const ETIQUETA: Record<Pestana, string> = { folio: "Con mi folio", frase: "Con mi frase" };

const dependencias = { buzon: buzonHttp, trabajo: trabajoEnWorker };

/** Los esquemas y la lista de palabras solo hacen falta al entrar. El fallo de red se dice en claro. */
const cargarConsulta = () =>
  import("@/lib/infraestructura/seguimiento-diferido").catch(() => {
    throw new Error(MENSAJE_SIN_CONEXION);
  });

const mensajeConsulta = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : mensajeDeError(error);

function Entrada({
  alEntrar,
}: {
  alEntrar: (credencial: Credencial, consulta: RespuestaConsulta) => void;
}) {
  const [pestana, setPestana] = useState<Pestana>("folio");
  const [valores, setValores] = useState<Record<Pestana, string>>({ folio: "", frase: "" });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const botones = useRef<Partial<Record<Pestana, HTMLButtonElement | null>>>({});
  const avisoError = useRef<HTMLDivElement>(null);
  const segundos = useSegundosEspera(cargando);
  const preparado = useRef(false);

  /** Al primer foco se baja lo que falta: esa espera no debe caer después de pulsar el botón. */
  const preparar = () => {
    if (preparado.current) return;
    preparado.current = true;
    prepararTrabajador();
    cargarConsulta().catch(() => {
      preparado.current = false;
    });
  };

  const alPulsarTecla = (evento: KeyboardEvent) => {
    const destino = pestanaPorTecla(PESTANAS, pestana, evento.key);
    if (!destino) return;
    evento.preventDefault();
    setPestana(destino);
    setError(null);
    botones.current[destino]?.focus();
  };

  const entrar = async (evento: FormEvent) => {
    evento.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const { consultarDenuncia } = await cargarConsulta();
      const { credencial, consulta } = await consultarDenuncia(
        { tipo: pestana, valor: valores[pestana] },
        dependencias,
      );
      // La credencial queda solo en la memoria de esta pantalla.
      setValores({ folio: "", frase: "" });
      alEntrar(credencial, consulta);
    } catch (causa) {
      setError(mensajeConsulta(causa));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (error) avisoError.current?.focus();
  }, [error]);

  return (
    <div className="mt-6">
      <p>Entra con el folio o con la frase de 6 palabras que guardaste. Con uno basta.</p>
      <div
        role="tablist"
        aria-label="Forma de entrar"
        className="mt-4 flex border-b border-borde-fuerte"
      >
        {PESTANAS.map((clave) => (
          <button
            key={clave}
            ref={(el) => {
              botones.current[clave] = el;
            }}
            id={`pestana-${clave}`}
            type="button"
            role="tab"
            aria-selected={pestana === clave}
            aria-controls="panel-acceso"
            tabIndex={pestana === clave ? 0 : -1}
            onKeyDown={alPulsarTecla}
            onClick={() => {
              setPestana(clave);
              setError(null);
            }}
            className={`min-h-11 flex-1 border-b-4 px-3 py-2 font-medium sm:flex-none ${
              pestana === clave
                ? "border-marca font-semibold"
                : "border-transparent text-tinta-suave"
            }`}
          >
            {ETIQUETA[clave]}
          </button>
        ))}
      </div>

      <form
        id="panel-acceso"
        onFocus={preparar}
        role="tabpanel"
        aria-labelledby={`pestana-${pestana}`}
        noValidate
        className="mt-5 space-y-4"
        onSubmit={entrar}
      >
        {pestana === "folio" ? (
          <Campo
            nombre="folio"
            etiqueta="Tu folio"
            ayuda="Empieza con BZ. Por ejemplo: BZ-1A2B-3C4D-5E6F-7G8H"
          >
            <input
              {...ariaCampo("folio", undefined, true)}
              key="folio"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className={`${CONTROL} font-mono`}
              value={valores.folio}
              onChange={(e) => setValores((v) => ({ ...v, folio: e.target.value }))}
            />
          </Campo>
        ) : (
          <Campo
            nombre="frase"
            etiqueta="Tu frase de 6 palabras"
            ayuda="Escríbela separada por espacios. No importan los acentos ni las mayúsculas. Se queda en este dispositivo."
          >
            <input
              {...ariaCampo("frase", undefined, true)}
              key="frase"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className={`${CONTROL} font-mono`}
              value={valores.frase}
              onChange={(e) => setValores((v) => ({ ...v, frase: e.target.value }))}
            />
          </Campo>
        )}

        <div ref={avisoError} tabIndex={-1} role="alert">
          {error && (
            <div className="border-l-4 border-peligro bg-peligro-suave p-4">
              <p>{error}</p>
            </div>
          )}
        </div>
        <p role="status" className="font-medium">
          {cargando && mensajeEsperaConsulta(segundos)}
        </p>
        <button type="submit" className={BOTON_PRIMARIO} disabled={cargando}>
          Ver mi denuncia
        </button>
      </form>
    </div>
  );
}

function Detalle({
  credencial,
  consulta,
  alActualizar,
  alCerrar,
}: {
  credencial: Credencial;
  consulta: RespuestaConsulta;
  alActualizar: (consulta: RespuestaConsulta) => void;
  alCerrar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => titulo.current?.focus(), []);

  const { pasadas, siguientes, concluida } = construirLineaTiempo(consulta);
  const actual = pasadas.find((p) => p.actual);
  const mensajes = describirMensajes(consulta.mensajes);

  const responder = async (evento: FormEvent) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    setAviso("");
    try {
      const { consultarConCredencial, enviarMensaje, sellar } = await cargarConsulta();
      await enviarMensaje({ credencial, texto }, { ...dependencias, sellar });
      setTexto("");
      setAviso("Tu mensaje se envió sellado para la autoridad.");
      alActualizar(await consultarConCredencial(credencial, dependencias));
    } catch (causa) {
      setError(mensajeConsulta(causa));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mt-6 space-y-10">
      <div>
        <h2 ref={titulo} tabIndex={-1} className="text-2xl font-semibold">
          {`Etapa actual: ${actual?.etiqueta ?? ""}`}
        </h2>
        <p className="mt-1">{actual?.explicacion}</p>
        <button type="button" className={`${BOTON_SECUNDARIO} mt-3`} onClick={alCerrar}>
          Cerrar esta denuncia en pantalla
        </button>
      </div>

      <section aria-labelledby="titulo-linea">
        <h3 id="titulo-linea" className="text-xl font-semibold">
          Línea de tiempo
        </h3>
        <ol className="mt-3 border-l-2 border-marca">
          {pasadas.map((etapa) => (
            <li
              key={`${etapa.etapa}-${etapa.dia}`}
              aria-current={etapa.actual ? "step" : undefined}
              className="relative pb-5 pl-5 last:pb-0"
            >
              <span
                aria-hidden="true"
                className={`absolute top-2 -left-[8px] size-3.5 rounded-full border-2 border-marca ${
                  etapa.actual ? "bg-marca" : "bg-papel"
                }`}
              />
              <p className="font-semibold">
                {etapa.etiqueta}
                {etapa.actual && <span className="font-normal"> (etapa actual)</span>}
              </p>
              <p className="text-tinta-suave">{etapa.diaLegible}</p>
              <p>{etapa.explicacion}</p>
              <p className="text-tinta-suave">Plazo esperado: {etapa.plazoEsperado}</p>
            </li>
          ))}
        </ol>
        {concluida && (
          <p className="mt-4 font-medium">Esta denuncia ya concluyó en esta instancia.</p>
        )}
        {siguientes.length > 0 && (
          <div className="mt-5">
            <h4 className="font-semibold">Lo que puede seguir</h4>
            <ul className="mt-1 list-disc pl-5">
              {siguientes.map((etapa) => (
                <li key={etapa.etapa}>
                  <strong>{etapa.etiqueta}.</strong> {etapa.explicacion}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby="titulo-mensajes">
        <h3 id="titulo-mensajes" className="text-xl font-semibold">
          Mensajes
        </h3>
        {mensajes.length === 0 ? (
          <p className="mt-2">Todavía no hay mensajes.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {mensajes.map((mensaje, i) => (
              <li
                key={i}
                className={`border-l-4 bg-superficie p-4 ${
                  mensaje.autor === "autoridad" ? "border-marca" : "border-borde-fuerte"
                }`}
              >
                <p className="font-semibold">
                  {mensaje.autorLegible}
                  <span className="font-normal text-tinta-suave">, {mensaje.diaLegible}</span>
                </p>
                <p className="mt-1 break-words whitespace-pre-wrap">{mensaje.texto}</p>
              </li>
            ))}
          </ul>
        )}

        <form noValidate className="mt-6 space-y-3" onSubmit={responder}>
          <Campo
            nombre="respuesta"
            etiqueta="Responder a la autoridad"
            ayuda="Se sella en este dispositivo. No incluyas datos que puedan identificarte."
            error={error ?? undefined}
          >
            <textarea
              {...ariaCampo("respuesta", error ?? undefined, true)}
              rows={4}
              maxLength={MAX_MENSAJE}
              spellCheck={false}
              className={CONTROL}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </Campo>
          <p role="status" className="font-medium">
            {enviando ? "Sellando y enviando…" : aviso}
          </p>
          <button type="submit" className={BOTON_PRIMARIO} disabled={enviando}>
            Enviar mensaje
          </button>
        </form>
      </section>

      <Aviso titulo="Antes de irte">
        <p>
          Esta página no guarda tu folio ni tu frase. Al cerrarla o recargarla tendrás que
          escribirlos otra vez.
        </p>
      </Aviso>
    </div>
  );
}

/** La credencial vive solo en este estado de React: nunca en la URL ni en almacenamiento. */
export function Seguimiento() {
  const [sesion, setSesion] = useState<{
    credencial: Credencial;
    consulta: RespuestaConsulta;
  } | null>(null);

  if (!sesion)
    return <Entrada alEntrar={(credencial, consulta) => setSesion({ credencial, consulta })} />;

  return (
    <Detalle
      credencial={sesion.credencial}
      consulta={sesion.consulta}
      alActualizar={(consulta) => setSesion({ ...sesion, consulta })}
      alCerrar={() => setSesion(null)}
    />
  );
}
