"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import { SITIO_NEUTRO, crearDetectorEscape } from "@/lib/denuncia/salida-rapida";
import { salirAhora } from "@/lib/infraestructura/navegador";

/** Es un enlace para que funcione aunque el JavaScript no haya terminado de cargar con mala señal. */
export function SalidaRapida() {
  const detector = useRef(crearDetectorEscape());

  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" && detector.current(evento.timeStamp)) salirAhora();
    };
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, []);

  const alHacerClic = (evento: MouseEvent) => {
    evento.preventDefault();
    salirAhora();
  };

  return (
    <a
      href={SITIO_NEUTRO}
      rel="noreferrer"
      onClick={alHacerClic}
      className="salida-rapida inline-flex min-h-11 items-center gap-2 rounded-sm bg-peligro px-3 py-2 text-sm font-semibold text-superficie no-underline hover:underline"
    >
      Salida rápida
      <span className="hidden font-normal md:inline">(Esc 3 veces)</span>
    </a>
  );
}
