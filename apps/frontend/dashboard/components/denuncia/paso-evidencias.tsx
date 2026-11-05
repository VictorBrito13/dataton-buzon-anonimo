"use client";

import type { RespuestaConfiguracion } from "@dataton/shared";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { Aviso, BOTON_SECUNDARIO } from "@/components/ui";
import type { EstadoAsistente } from "@/lib/denuncia/asistente";
import { mensajeDeError } from "@/lib/denuncia/errores";
import { describirTamano, describirTipos } from "@/lib/denuncia/evidencias";
import { subirEvidencia } from "@/lib/denuncia/subir-evidencia";
import { buzonHttp } from "@/lib/infraestructura/buzon-http";
import { trabajoEnWorker } from "@/lib/infraestructura/trabajo";
import { limpiarArchivo } from "@/lib/privacidad";
import type { Despachar } from "./asistente";

type Rechazo = { nombre: string; motivo: string };

const listar = (eliminados: string[]) =>
  eliminados.length > 0 ? eliminados.join(", ") : "No había datos ocultos que quitar.";

export function PasoEvidencias({
  estado,
  despachar,
}: {
  estado: EstadoAsistente;
  despachar: Despachar;
}) {
  const [limites, setLimites] = useState<RespuestaConfiguracion | null>(null);
  const [falloLimites, setFalloLimites] = useState<string | null>(null);
  const [progreso, setProgreso] = useState("");
  const [rechazos, setRechazos] = useState<Rechazo[]>([]);
  const trabajando = progreso !== "";

  const cargarLimites = useCallback(() => {
    buzonHttp.obtenerConfiguracion().then(
      (configuracion) => {
        setLimites(configuracion);
        setFalloLimites(null);
      },
      (error: unknown) => setFalloLimites(mensajeDeError(error)),
    );
  }, []);

  useEffect(cargarLimites, [cargarLimites]);

  const alElegir = async (evento: ChangeEvent<HTMLInputElement>) => {
    const entrada = evento.target;
    const archivos = Array.from(entrada.files ?? []);
    if (!limites || archivos.length === 0) return;
    setRechazos([]);
    let cantidad = estado.evidencias.length;
    // Una a una: con mala señal, una falla no echa a perder las demás.
    for (const archivo of archivos) {
      setProgreso(`Limpiando y enviando ${archivo.name}…`);
      try {
        const evidencia = await subirEvidencia(
          { archivo, limites, cantidadActual: cantidad },
          { limpiar: limpiarArchivo, trabajo: trabajoEnWorker, buzon: buzonHttp },
        );
        despachar({ tipo: "evidenciaAgregada", evidencia });
        cantidad += 1;
      } catch (error) {
        const motivo = error instanceof Error ? error.message : mensajeDeError(error);
        setRechazos((actuales) => [...actuales, { nombre: archivo.name, motivo }]);
      }
    }
    setProgreso("");
    entrada.value = "";
  };

  return (
    <div className="space-y-5">
      <p>
        Fotos o documentos que respalden lo que cuentas. Este paso es opcional. Antes de enviar cada
        archivo, tu dispositivo le quita datos ocultos como el GPS o el autor; luego el servidor lo
        revisa otra vez y lo sella para la autoridad.
      </p>
      <Aviso titulo="Lo que se ve en un archivo no se puede limpiar">
        <p>
          Una cara, una firma o un membrete dentro de la foto o el documento sí pueden
          identificarte.
        </p>
      </Aviso>

      {falloLimites && (
        <div role="alert" className="border-l-4 border-peligro bg-peligro-suave p-4">
          <p>{falloLimites}</p>
          <button type="button" className={`${BOTON_SECUNDARIO} mt-3`} onClick={cargarLimites}>
            Intentar de nuevo
          </button>
          <p className="mt-2">También puedes continuar sin adjuntar archivos.</p>
        </div>
      )}

      {limites && (
        <div>
          <p id="campo-archivos-ayuda" className="mb-2 text-tinta-suave">
            {`Hasta ${limites.maxEvidencias} archivos de ${describirTamano(limites.maxBytesEvidencia)} cada uno. Tipos: ${describirTipos(limites.tiposEvidencia)}.`}
          </p>
          {/* Control propio: el nativo muestra su texto en el idioma del navegador. */}
          <input
            id="campo-archivos"
            aria-describedby="campo-archivos-ayuda"
            type="file"
            multiple
            accept={limites.tiposEvidencia.join(",")}
            disabled={trabajando}
            className="peer sr-only"
            onChange={alElegir}
          />
          <label
            htmlFor="campo-archivos"
            className={`${BOTON_SECUNDARIO} w-full cursor-pointer peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-marca peer-disabled:opacity-60 sm:w-auto`}
          >
            Elige tus archivos
          </label>
        </div>
      )}

      <p role="status" className="font-medium">
        {progreso}
      </p>

      {rechazos.length > 0 && (
        <div role="alert" className="border-l-4 border-peligro bg-peligro-suave p-4">
          <p className="font-semibold">Estos archivos no se enviaron:</p>
          <ul className="mt-1 list-disc pl-5">
            {rechazos.map(({ nombre, motivo }) => (
              <li key={nombre} className="break-words">
                <strong>{nombre}:</strong> {motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      {estado.evidencias.length > 0 && (
        <div>
          <h3 className="font-semibold">Archivos listos</h3>
          <ul className="mt-2 space-y-3">
            {estado.evidencias.map((evidencia) => (
              <li key={evidencia.evidenciaId} className="border border-borde bg-superficie p-4">
                <p className="font-medium break-words">
                  {evidencia.nombre}{" "}
                  <span className="font-normal text-tinta-suave">
                    ({describirTamano(evidencia.tamano)})
                  </span>
                </p>
                <p className="mt-1">
                  <strong>Quitado en tu dispositivo:</strong>{" "}
                  {listar(evidencia.eliminadosEnDispositivo)}
                </p>
                <p>
                  <strong>Quitado en el servidor:</strong> {listar(evidencia.eliminadosEnServidor)}
                </p>
                <button
                  type="button"
                  className={`${BOTON_SECUNDARIO} mt-2`}
                  onClick={() =>
                    despachar({ tipo: "evidenciaQuitada", evidenciaId: evidencia.evidenciaId })
                  }
                >
                  {`Quitar ${evidencia.nombre}`}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
