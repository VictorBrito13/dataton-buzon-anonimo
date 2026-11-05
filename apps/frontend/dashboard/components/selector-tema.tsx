"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import {
  CLAVE_TEMA,
  PREFERENCIAS_TEMA,
  aplicarPreferencia,
  guardarPreferencia,
  leerPreferencia,
  type PreferenciaTema,
} from "@/lib/tema/tema";

const ETIQUETAS: Record<PreferenciaTema, string> = {
  claro: "Claro",
  oscuro: "Oscuro",
  automatico: "Automático",
};

const TRAZOS: Record<PreferenciaTema, ReactNode> = {
  claro: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
  oscuro: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  automatico: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
    </>
  ),
};

const Icono = ({ tema, className }: { tema: PreferenciaTema; className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
    focusable="false"
    className={className}
  >
    {TRAZOS[tema]}
  </svg>
);

/** Sobrevive al almacenamiento bloqueado: la elección dura al menos mientras la página viva. */
let enMemoria: PreferenciaTema | null = null;
const avisos = new Set<() => void>();

const leerActual = (): PreferenciaTema => {
  if (enMemoria) return enMemoria;
  try {
    return leerPreferencia(localStorage);
  } catch {
    return "automatico";
  }
};

const elegir = (preferencia: PreferenciaTema): void => {
  enMemoria = preferencia;
  try {
    guardarPreferencia(localStorage, preferencia);
  } catch {
    // Sin almacenamiento, el tema se aplica solo a esta página.
  }
  aplicarPreferencia(document.documentElement, preferencia);
  avisos.forEach((avisar) => avisar());
};

const suscribir = (avisar: () => void) => {
  /** Otra pestaña cambió el tema o usó la salida rápida. */
  const alCambiarOtraPestana = (evento: StorageEvent) => {
    if (evento.key !== CLAVE_TEMA && evento.key !== null) return;
    enMemoria = null;
    aplicarPreferencia(document.documentElement, leerActual());
    avisar();
  };
  avisos.add(avisar);
  window.addEventListener("storage", alCambiarOtraPestana);
  return () => {
    avisos.delete(avisar);
    window.removeEventListener("storage", alCambiarOtraPestana);
  };
};

/**
 * Menú nativo con radios: el teclado funciona con flechas y la opción activa se ve por el punto
 * del radio y el texto en negritas, no solo por el color. El icono del botón lo decide el CSS
 * según la marca de <html>, para que no parpadee antes de hidratar.
 */
export function SelectorTema() {
  const menu = useRef<HTMLDetailsElement>(null);
  const preferencia = useSyncExternalStore(suscribir, leerActual, () => "automatico" as const);

  useEffect(() => {
    const cerrar = (devolverFoco: boolean) => {
      const detalles = menu.current;
      if (!detalles?.open) return;
      detalles.open = false;
      if (devolverFoco) detalles.querySelector("summary")?.focus();
    };
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") cerrar(true);
    };
    const alTocarFuera = (evento: PointerEvent) => {
      if (!menu.current?.contains(evento.target as Node)) cerrar(false);
    };
    const alEnfocar = (evento: FocusEvent) => {
      if (!menu.current?.contains(evento.target as Node)) cerrar(false);
    };
    document.addEventListener("keydown", alPulsar);
    document.addEventListener("pointerdown", alTocarFuera);
    document.addEventListener("focusin", alEnfocar);
    return () => {
      document.removeEventListener("keydown", alPulsar);
      document.removeEventListener("pointerdown", alTocarFuera);
      document.removeEventListener("focusin", alEnfocar);
    };
  }, []);

  return (
    <details ref={menu} className="relative max-sm:static print:hidden">
      <summary
        aria-label={`Tema: ${ETIQUETAS[preferencia]}`}
        className="inline-flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center gap-2 rounded-sm border border-borde-fuerte bg-superficie px-2 text-sm font-medium text-tinta hover:bg-marca-suave [&::-webkit-details-marker]:hidden"
      >
        {PREFERENCIAS_TEMA.map((tema) => (
          <Icono key={tema} tema={tema} className={`icono-tema-${tema}`} />
        ))}
        <span className="hidden md:inline">Tema</span>
      </summary>
      <fieldset className="menu-tema absolute top-full right-0 z-20 mt-1 w-44 max-sm:right-4 max-sm:left-4 max-sm:w-auto rounded-sm border border-borde-fuerte bg-superficie p-1 shadow-lg">
        <legend className="sr-only">Tema de la página</legend>
        {PREFERENCIAS_TEMA.map((tema) => (
          <label
            key={tema}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm text-tinta hover:bg-marca-suave has-checked:font-semibold"
          >
            <input
              type="radio"
              name="tema"
              value={tema}
              checked={preferencia === tema}
              onChange={() => elegir(tema)}
              className="size-4 accent-marca"
            />
            <Icono tema={tema} />
            {ETIQUETAS[tema]}
          </label>
        ))}
      </fieldset>
    </details>
  );
}
