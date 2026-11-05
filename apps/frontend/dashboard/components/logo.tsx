/**
 * Una persona sin rostro cuyo cuerpo es un sobre. Los colores salen de los tokens, así que cambia
 * con el tema. Decorativo: quien lo rodea da el nombre accesible.
 */
export function SimboloLogo({ className = "size-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      <rect className="fill-marca" width="32" height="32" rx="7" />
      <circle className="fill-papel" cx="16" cy="9.5" r="5" />
      <rect className="fill-papel" x="6" y="16.5" width="20" height="11" rx="2" />
      <path className="fill-none stroke-marca" d="M7 18l9 6 9-6" strokeWidth="2" />
    </svg>
  );
}

/**
 * Símbolo y nombre. Bajo 360 px solo se ve el símbolo, para que el encabezado fijo quede en una fila
 * también con fuentes del sistema más anchas; el nombre sigue disponible para lectores de pantalla.
 */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <SimboloLogo />
      <span className="sr-only leading-tight font-semibold min-[360px]:not-sr-only min-[360px]:max-w-min sm:max-w-none">
        Buzón Anónimo
      </span>
    </span>
  );
}
