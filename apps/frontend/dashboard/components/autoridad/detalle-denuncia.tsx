"use client";

import "@/lib/autoridad/zod-sin-eval";
import { ESTADOS, ETAPAS, TIPOS_FALTA, type Etapa } from "@dataton/shared";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { obtenerDenuncia } from "@/lib/autoridad/api";
import { CambioEtapa } from "./cambio-etapa";
import { ContenidoSellado } from "./contenido-sellado";
import { ALERTA, BOTON_SECUNDARIO, SECCION, TITULO_SECCION } from "./estilos";
import { Evidencias } from "./evidencias";
import { Mensajes } from "./mensajes";
import { useCarga } from "./use-carga";

export function DetalleDenuncia({ id }: { id: string }) {
  const cargar = useCallback((signal: AbortSignal) => obtenerDenuncia(id, signal), [id]);
  const { datos: denuncia, error, cargando, recargar } = useCarga(cargar);
  const [aviso, setAviso] = useState("");
  const tituloEtapa = useRef<HTMLHeadingElement>(null);

  const alCambiarEtapa = (destino: Etapa) => {
    setAviso(`Etapa actualizada a: ${ETAPAS[destino].etiqueta}.`);
    // El botón que abrió la confirmación desaparece al cambiar de etapa: el foco no debe perderse.
    tituloEtapa.current?.focus();
    recargar();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm">
        <Link href="/autoridad" className="text-marca underline underline-offset-2">
          Volver a la lista
        </Link>
      </p>
      <h1 className="text-2xl font-semibold">
        Denuncia <span className="font-mono">{id.slice(0, 8)}</span>
      </h1>

      {error && (
        <div role="alert" className={`${ALERTA} flex flex-wrap items-center gap-3`}>
          <span>{error}</span>
          <button type="button" className={BOTON_SECUNDARIO} onClick={recargar}>
            Reintentar
          </button>
        </div>
      )}
      <p role="status" className="text-sm text-exito">
        {aviso}
      </p>
      {!denuncia && cargando && <p className="text-sm text-tinta-suave">Cargando denuncia…</p>}

      {denuncia && (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <section aria-labelledby="titulo-relato" className={SECCION}>
              <h2 id="titulo-relato" className={TITULO_SECCION}>
                Relato
              </h2>
              <ContenidoSellado sello={denuncia.relatoSellado} />
            </section>
            <section aria-labelledby="titulo-evidencias" className={SECCION}>
              <h2 id="titulo-evidencias" className={TITULO_SECCION}>
                Evidencias
              </h2>
              <Evidencias denunciaId={denuncia.id} evidencias={denuncia.evidencias} />
            </section>
            <section aria-labelledby="titulo-mensajes" className={SECCION}>
              <h2 id="titulo-mensajes" className={TITULO_SECCION}>
                Mensajes
              </h2>
              <Mensajes denunciaId={denuncia.id} mensajes={denuncia.mensajes} alEnviar={recargar} />
            </section>
          </div>

          <div className="space-y-4">
            <section aria-labelledby="titulo-datos" className={SECCION}>
              <h2 id="titulo-datos" className={TITULO_SECCION}>
                Datos sin sellar
              </h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="font-semibold">Recibida</dt>
                <dd>{denuncia.recibidaDia}</dd>
                <dt className="font-semibold">Estado</dt>
                <dd>{ESTADOS[denuncia.estado]}</dd>
                <dt className="font-semibold">Municipio</dt>
                <dd>{denuncia.municipio ?? "No indicado"}</dd>
                <dt className="font-semibold">Falta</dt>
                <dd>{TIPOS_FALTA[denuncia.tipoFalta].etiqueta}</dd>
                <dt className="font-semibold">Ente</dt>
                <dd>{denuncia.enteId ?? "No indicado"}</dd>
              </dl>
            </section>
            <section aria-labelledby="titulo-etapa" className={SECCION}>
              <h2 id="titulo-etapa" ref={tituloEtapa} tabIndex={-1} className={TITULO_SECCION}>
                Etapa: {ETAPAS[denuncia.etapa].etiqueta}
              </h2>
              <p className="mb-3 text-xs text-tinta-suave">
                Plazo esperado: {ETAPAS[denuncia.etapa].plazoEsperado}
              </p>
              <CambioEtapa
                denunciaId={denuncia.id}
                etapa={denuncia.etapa}
                alCambiar={alCambiarEtapa}
              />
            </section>
            <section aria-labelledby="titulo-linea" className={SECCION}>
              <h2 id="titulo-linea" className={TITULO_SECCION}>
                Línea de tiempo
              </h2>
              <ol className="space-y-2 border-l-2 border-borde-fuerte pl-3 text-sm">
                {denuncia.lineaTiempo.map(({ etapa, dia }, indice) => {
                  const esActual = indice === denuncia.lineaTiempo.length - 1;
                  return (
                    <li key={`${etapa}-${dia}`} aria-current={esActual ? "step" : undefined}>
                      <span className={esActual ? "font-semibold" : undefined}>
                        {ETAPAS[etapa].etiqueta}
                      </span>
                      <br />
                      <time dateTime={dia} className="text-xs text-tinta-suave">
                        {dia}
                      </time>
                    </li>
                  );
                })}
              </ol>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
