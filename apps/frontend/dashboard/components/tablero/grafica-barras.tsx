import type { CeldaAgregada } from "@dataton/shared";
import { etiquetaConteo, porcentajeDe } from "@/lib/tablero/celdas";
import { TablaDesplazable, TablaEquivalente } from "./piezas";

export interface FilaBarra extends Pick<CeldaAgregada, "conteo" | "motivo"> {
  clave: string;
  etiqueta: string;
}

const ALTO = 12;

/**
 * Barras horizontales de una sola serie. Las etiquetas son HTML y la barra un SVG con ancho en
 * porcentaje: a 320 px el texto conserva su tamaño, y no hace falta style= en línea (CSP).
 * Una celda oculta dibuja un contorno punteado de largo fijo, sin insinuar su valor.
 */
export function GraficaBarras({
  titulo,
  filas,
  k,
  encabezadoEtiqueta,
}: {
  titulo: string;
  filas: readonly FilaBarra[];
  k: number;
  encabezadoEtiqueta: string;
}) {
  const maximo = Math.max(0, ...filas.map((f) => f.conteo ?? 0));
  const publicadas = filas.filter((f) => f.conteo !== null).length;
  return (
    <>
      <div
        role="img"
        aria-label={`${titulo}. ${publicadas} de ${filas.length} categorías publicadas. Los valores están en la tabla equivalente.`}
        className="space-y-2.5"
      >
        {filas.map((fila) => (
          <div key={fila.clave}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 wrap-anywhere">{fila.etiqueta}</span>
              <span className="shrink-0 font-semibold tabular-nums">{etiquetaConteo(fila, k)}</span>
            </div>
            <svg width="100%" height={ALTO} aria-hidden="true" focusable="false" className="block">
              <rect className="barra-fondo" x="0" y="0" width="100%" height={ALTO} rx="2" />
              {fila.conteo === null ? (
                <rect className="barra-oculta" x="1" y="1" width="12%" height={ALTO - 2} rx="2" />
              ) : (
                <rect
                  className="barra"
                  x="0"
                  y="0"
                  width={`${porcentajeDe(fila.conteo, maximo)}%`}
                  height={ALTO}
                  rx="2"
                />
              )}
            </svg>
          </div>
        ))}
      </div>
      <TablaEquivalente>
        <TablaDesplazable titulo={titulo}>
          <thead>
            <tr>
              <th scope="col">{encabezadoEtiqueta}</th>
              <th scope="col">Denuncias</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.clave}>
                <td>{fila.etiqueta}</td>
                <td className="tabular-nums">{etiquetaConteo(fila, k)}</td>
              </tr>
            ))}
          </tbody>
        </TablaDesplazable>
      </TablaEquivalente>
    </>
  );
}
