import { CLAVES_ESTADO, ESTADOS, type CeldaAgregada, type ClaveEstado } from "@dataton/shared";
import { calcularCortes, etiquetaConteo, formatoNumero, nivelDeConteo } from "@/lib/tablero/celdas";
import { CUADRICULA_ESTADOS } from "@/lib/tablero/mapa-cuadricula";
import { TablaDesplazable, TablaEquivalente } from "./piezas";

const CASILLA = 60;
const SEPARACION = 4;
const PASO = CASILLA + SEPARACION;
const COLUMNAS = 10;
const FILAS = 5;

export const claseNivel = (
  celda: Pick<CeldaAgregada, "conteo">,
  cortes: readonly number[],
): string =>
  celda.conteo === null ? "nivel-oculto" : `nivel-${nivelDeConteo(celda.conteo, cortes)}`;

const textoNivel = (celda: Pick<CeldaAgregada, "conteo">, cortes: readonly number[]): string =>
  celda.conteo === null ? "" : `texto-nivel-${nivelDeConteo(celda.conteo, cortes)}`;

const Muestra = ({ clase, texto }: { clase: string; texto: string }) => (
  <li className="flex items-center gap-1.5">
    <svg width="18" height="18" aria-hidden="true" focusable="false">
      <rect className={clase} x="1" y="1" width="16" height="16" rx="2" />
    </svg>
    <span>{texto}</span>
  </li>
);

const textosLeyenda = (cortes: readonly number[]): string[] => {
  const [a = 0, b = 0, c = 0, d = 0] = cortes;
  const rango = (desde: number, hasta: number): string =>
    desde >= hasta ? formatoNumero(hasta) : `${formatoNumero(desde)} a ${formatoNumero(hasta)}`;
  return [
    `Hasta ${formatoNumero(a)}`,
    rango(a + 1, b),
    rango(b + 1, c),
    rango(c + 1, d),
    `Más de ${formatoNumero(d)}`,
  ];
};

/** Mapa de cuadrícula en SVG propio. Cada casilla es un enlace: funciona con teclado y sin JS. */
export function MapaEstados({
  celdas,
  k,
  periodo,
  seleccionado,
}: {
  celdas: readonly CeldaAgregada[];
  k: number;
  periodo: string;
  seleccionado: string | null;
}) {
  const porEstado = new Map(celdas.map((c) => [c.claves.estado, c]));
  const leer = (estado: string): CeldaAgregada =>
    porEstado.get(estado) ?? { claves: { estado }, conteo: 0, motivo: "publicada" };
  const cortes = calcularCortes(celdas.flatMap((c) => (c.conteo === null ? [] : [c.conteo])));
  const leyenda = textosLeyenda(cortes);

  return (
    <>
      <svg
        viewBox={`0 0 ${COLUMNAS * PASO} ${FILAS * PASO}`}
        role="group"
        aria-label="Mapa de cuadrícula de México. Cada casilla es un estado; elige una para ver sus municipios."
        className="block h-auto w-full"
      >
        {CLAVES_ESTADO.map((estado: ClaveEstado) => {
          const { columna, fila, abreviatura } = CUADRICULA_ESTADOS[estado];
          const celda = leer(estado);
          const valor = etiquetaConteo(celda, k);
          const activa = estado === seleccionado;
          const x = columna * PASO + SEPARACION / 2;
          const y = fila * PASO + SEPARACION / 2;
          return (
            <a
              key={estado}
              href={`/tablero?periodo=${periodo}&estado=${estado}#municipios`}
              aria-current={activa ? "true" : undefined}
              className={`casilla ${activa ? "casilla-activa" : ""}`}
            >
              {/* Da el nombre accesible y el aviso al pasar el cursor. */}
              <title>{`${ESTADOS[estado]}: ${valor}. Ver municipios.`}</title>
              <rect
                className={claseNivel(celda, cortes)}
                x={x}
                y={y}
                width={CASILLA}
                height={CASILLA}
                rx="3"
              />
              <text
                className={`texto-casilla texto-casilla-abrev ${textoNivel(celda, cortes)}`}
                x={x + CASILLA / 2}
                y={y + 25}
              >
                {abreviatura}
              </text>
              <text
                className={`texto-casilla ${textoNivel(celda, cortes)}`}
                x={x + CASILLA / 2}
                y={y + 47}
              >
                {valor === "Oculta" ? "—" : valor}
              </text>
            </a>
          );
        })}
      </svg>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-suave" aria-label="Leyenda">
        {leyenda.map((texto, i) => (
          <Muestra key={texto} clase={`nivel-${i + 1}`} texto={texto} />
        ))}
        <Muestra clase="nivel-0" texto="0" />
        <Muestra clase="nivel-oculto" texto={`Oculta o < ${k} (— es oculta)`} />
      </ul>
      <p className="text-xs text-tinta-suave">
        Es un mapa de cuadrícula: la posición de cada estado es aproximada y todas las casillas
        miden lo mismo. No son contornos reales.
      </p>
      <TablaEquivalente resumen="Ver los 32 estados en una tabla">
        <TablaDesplazable titulo="Denuncias por estado">
          <thead>
            <tr>
              <th scope="col">Estado</th>
              <th scope="col">Denuncias</th>
            </tr>
          </thead>
          <tbody>
            {CLAVES_ESTADO.map((estado: ClaveEstado) => (
              <tr key={estado}>
                <td>
                  <a
                    className="underline underline-offset-4"
                    href={`/tablero?periodo=${periodo}&estado=${estado}#municipios`}
                  >
                    {ESTADOS[estado]}
                  </a>
                </td>
                <td className="tabular-nums">{etiquetaConteo(leer(estado), k)}</td>
              </tr>
            ))}
          </tbody>
        </TablaDesplazable>
      </TablaEquivalente>
    </>
  );
}
