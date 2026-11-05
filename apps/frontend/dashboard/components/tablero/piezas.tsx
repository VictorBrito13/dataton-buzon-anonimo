import type { ReactNode } from "react";

/** Distingue de un vistazo qué cifras son inventadas y cuáles provienen de la PDN. */
export function EtiquetaOrigen({ origen }: { origen: "sintetico" | "pdn" }) {
  return origen === "sintetico" ? (
    <span className="inline-block rounded border border-aviso bg-aviso-suave px-2 py-0.5 text-xs font-semibold text-aviso">
      Datos sintéticos
    </span>
  ) : (
    <span className="inline-block rounded border border-exito bg-exito-suave px-2 py-0.5 text-xs font-semibold text-exito">
      Datos reales de la PDN
    </span>
  );
}

export function Panel({
  titulo,
  id,
  children,
  nivel = 3,
}: {
  titulo: string;
  id?: string;
  children: ReactNode;
  nivel?: 2 | 3;
}) {
  const Encabezado = nivel === 2 ? "h2" : "h3";
  return (
    <section
      id={id}
      className="scroll-mt-4 rounded-md border border-borde bg-superficie p-4"
      aria-label={titulo}
    >
      <Encabezado className="text-lg font-semibold">{titulo}</Encabezado>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

/** Tabla con desplazamiento propio, para que la página nunca se desplace de lado a 320 px. */
export function TablaDesplazable({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label={titulo}
      tabIndex={0}
      className="max-w-full overflow-x-auto rounded border border-borde"
    >
      <table className="w-full border-collapse text-sm [&_td]:border-t [&_td]:border-borde [&_td]:px-3 [&_td]:py-1.5 [&_th]:border-borde [&_th]:bg-papel [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold">
        <caption className="sr-only">{titulo}</caption>
        {children}
      </table>
    </div>
  );
}

export function TablaEquivalente({
  resumen = "Ver tabla con los mismos datos",
  children,
}: {
  resumen?: string;
  children: ReactNode;
}) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-marca underline underline-offset-4">
        {resumen}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
