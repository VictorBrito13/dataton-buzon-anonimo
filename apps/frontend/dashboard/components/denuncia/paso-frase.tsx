"use client";

import { useEffect, useRef, useState } from "react";
import { Aviso, BOTON_PRIMARIO, BOTON_SECUNDARIO, CONTROL, Campo, idCampo } from "@/components/ui";
import type { EstadoAsistente } from "@/lib/denuncia/asistente";
import { palabrasDeFrase } from "@/lib/denuncia/frase";
import type { Despachar } from "./asistente";

export function PasoFrase({
  estado,
  despachar,
  avanzar,
}: {
  estado: EstadoAsistente;
  despachar: Despachar;
  avanzar: () => void;
}) {
  const { frase, posiciones, errores } = estado;
  const [confirmando, setConfirmando] = useState(false);
  const [respuestas, setRespuestas] = useState(["", ""]);
  const [qr, setQr] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const tituloConfirmar = useRef<HTMLHeadingElement>(null);
  const tituloFrase = useRef<HTMLHeadingElement>(null);
  const cambioVista = useRef(false);

  useEffect(() => {
    if (!cambioVista.current) return;
    (confirmando ? tituloConfirmar : tituloFrase).current?.focus();
  }, [confirmando]);

  if (!frase || !posiciones) return null;

  const cambiarVista = (valor: boolean) => {
    cambioVista.current = true;
    setConfirmando(valor);
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(frase);
      setAviso("Frase copiada. Pégala donde la vayas a guardar y luego copia otra cosa encima.");
    } catch {
      setAviso("No pudimos copiarla. Anótala a mano.");
    }
  };

  const alternarQr = async () => {
    if (qr) {
      setQr(null);
      setAviso("Código QR oculto.");
      return;
    }
    // Se genera aquí mismo, sin servicios externos. Solo se baja si la persona lo pide.
    const { toDataURL } = await import("qrcode");
    setQr(await toDataURL(frase, { margin: 2, width: 240 }));
    setAviso("Código QR generado.");
  };

  if (confirmando) {
    const error = errores.confirmacion;
    return (
      <div className="space-y-5">
        <h3 ref={tituloConfirmar} tabIndex={-1} className="text-xl font-semibold">
          Comprueba que la guardaste
        </h3>
        <p>Escribe estas dos palabras tal como aparecen en lo que guardaste.</p>
        {posiciones.map((posicion, i) => {
          const nombre = `palabra-${i}`;
          return (
            <Campo key={nombre} nombre={nombre} etiqueta={`Palabra número ${posicion + 1}`}>
              <input
                id={idCampo(nombre)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "error-confirmacion" : undefined}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className={CONTROL}
                value={respuestas[i]}
                onChange={(e) =>
                  setRespuestas((r) => r.map((v, j) => (j === i ? e.target.value : v)))
                }
              />
            </Campo>
          );
        })}
        <div role="alert">
          {error && (
            <p id="error-confirmacion" className="font-medium text-peligro">
              <span aria-hidden="true">✕ </span>
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className={BOTON_PRIMARIO}
            onClick={() => {
              despachar({ tipo: "confirmarFrase", respuestas });
              avanzar();
            }}
          >
            Confirmar y continuar
          </button>
          <button type="button" className={BOTON_SECUNDARIO} onClick={() => cambiarVista(false)}>
            Volver a ver mi frase
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p>
        Esta frase de 6 palabras es tu llave para volver a tu denuncia. Se creó en este dispositivo
        y nunca se envía. <strong>Nadie puede recuperarla por ti.</strong>
      </p>

      <section
        aria-labelledby="titulo-frase"
        className="area-impresion border-2 border-marca bg-superficie p-5"
      >
        <h3 id="titulo-frase" ref={tituloFrase} tabIndex={-1} className="font-semibold">
          Tu frase
        </h3>
        <ol className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {palabrasDeFrase(frase).map((palabra, i) => (
            <li key={i} className="flex items-baseline gap-3">
              <span className="w-5 text-right text-tinta-suave">{i + 1}</span>
              <span className="font-mono text-2xl font-semibold">{palabra}</span>
            </li>
          ))}
        </ol>
        {qr && (
          // Imagen generada en el dispositivo como data: URI; next/image no aplica.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            width={240}
            height={240}
            alt="Código QR que contiene tu frase de 6 palabras"
            className="mt-4"
          />
        )}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button type="button" className={BOTON_SECUNDARIO} onClick={copiar}>
          Copiar
        </button>
        <button type="button" className={BOTON_SECUNDARIO} onClick={() => window.print()}>
          Imprimir
        </button>
        <button type="button" className={BOTON_SECUNDARIO} onClick={alternarQr}>
          {qr ? "Ocultar código QR" : "Mostrar código QR"}
        </button>
      </div>
      <p role="status" className="font-medium">
        {aviso}
      </p>

      <Aviso titulo="Cómo guardarla">
        <p>
          Lo más seguro es anotarla en papel y guardarla donde nadie la encuentre. No la mandes por
          mensaje ni le tomes foto si alguien más usa este equipo.
        </p>
      </Aviso>

      <button
        type="button"
        className={`${BOTON_PRIMARIO} w-full sm:w-auto`}
        onClick={() => cambiarVista(true)}
      >
        Ya la guardé
      </button>
    </div>
  );
}
