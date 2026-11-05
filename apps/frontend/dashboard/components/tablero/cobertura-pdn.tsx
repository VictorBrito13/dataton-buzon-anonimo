import {
  CLAVES_ESTADO,
  DETALLE_SISTEMAS,
  ESTADOS,
  SISTEMAS_COBERTURA,
  type ClaveEstado,
  type FilaCobertura,
  type RespuestaCoberturaPdn,
  type SistemaCobertura,
} from "@dataton/shared";
import { formatoNumero } from "@/lib/tablero/celdas";
import {
  enlaceCobertura,
  etiquetaMapa,
  etiquetaPorcentaje,
  filasDeEstados,
  lecturaDeSistema,
  nivelCobertura,
  ordenarPorCobertura,
  textoLectura,
  UMBRAL_DENOMINADOR_BAJO,
} from "@/lib/tablero/cobertura";
import { CUADRICULA_ESTADOS } from "@/lib/tablero/mapa-cuadricula";
import { EtiquetaOrigen, Panel, TablaDesplazable, TablaEquivalente } from "./piezas";

const CASILLA = 60;
const SEPARACION = 4;
const PASO = CASILLA + SEPARACION;
const COLUMNAS = 10;
const FILAS = 5;
const TRAMA = "trama-cobertura-cero";

const claseTexto = (clase: string): string =>
  clase === "nivel-4" || clase === "nivel-5" ? `texto-${clase}` : "";

/** Una textura, no solo un tono: el cero se reconoce también sin color y al imprimir. */
const rellenoDe = (clase: string): string | undefined =>
  clase === "cobertura-cero" ? `url(#${TRAMA})` : undefined;

const Muestra = ({ clase, texto }: { clase: string; texto: string }) => (
  <li className="flex items-center gap-1.5">
    <svg width="18" height="18" aria-hidden="true" focusable="false">
      <rect className={clase} fill={rellenoDe(clase)} x="1" y="1" width="16" height="16" rx="2" />
    </svg>
    <span>{texto}</span>
  </li>
);

const LEYENDA = [
  { clase: "cobertura-cero", texto: "0%, con trama" },
  { clase: "nivel-1", texto: "Menos de 20%" },
  { clase: "nivel-2", texto: "20 a 39%" },
  { clase: "nivel-3", texto: "40 a 59%" },
  { clase: "nivel-4", texto: "60 a 79%" },
  { clase: "nivel-5", texto: "80% o más" },
];

function MapaCobertura({
  filas,
  sistema,
}: {
  filas: readonly FilaCobertura[];
  sistema: SistemaCobertura;
}) {
  const { etiqueta } = DETALLE_SISTEMAS[sistema];
  const porEstado = new Map(filas.map((f) => [f.entidad, f]));
  return (
    <div
      role="region"
      aria-label={`Mapa de cobertura de ${etiqueta}, con desplazamiento propio`}
      tabIndex={0}
      className="overflow-x-auto"
    >
      <svg
        viewBox={`0 0 ${COLUMNAS * PASO} ${FILAS * PASO}`}
        role="img"
        aria-label={`Mapa de cuadrícula de México: porcentaje de registros conectados a ${etiqueta} por estado. Las mismas cifras están en la tabla de abajo.`}
        className="mx-auto block h-auto w-full max-w-4xl min-w-[30rem]"
      >
        <defs>
          <pattern
            id={TRAMA}
            patternUnits="userSpaceOnUse"
            width="9"
            height="9"
            patternTransform="rotate(45)"
          >
            <rect className="trama-fondo" width="9" height="9" />
            <line className="trama-linea" x1="0" y1="0" x2="0" y2="9" />
          </pattern>
        </defs>
        {CLAVES_ESTADO.map((estado: ClaveEstado) => {
          const fila = porEstado.get(estado);
          if (!fila) return null;
          const conexion = fila[sistema];
          const { columna, fila: renglon, abreviatura } = CUADRICULA_ESTADOS[estado];
          const clase = nivelCobertura(conexion.porcentaje);
          const x = columna * PASO + SEPARACION / 2;
          const y = renglon * PASO + SEPARACION / 2;
          return (
            <g key={estado} className="casilla-cobertura">
              <title>
                {`${fila.nombre}: ${formatoNumero(conexion.conectados)} de ${formatoNumero(conexion.aplicables)} conectados a ${etiqueta} (${etiquetaPorcentaje(conexion.porcentaje)}).`}
              </title>
              <rect
                className={clase}
                fill={rellenoDe(clase)}
                x={x}
                y={y}
                width={CASILLA}
                height={CASILLA}
                rx="3"
              />
              <text
                className={`texto-casilla texto-casilla-abrev ${claseTexto(clase)}`}
                x={x + CASILLA / 2}
                y={y + 25}
              >
                {abreviatura}
              </text>
              <text className={`texto-casilla ${claseTexto(clase)}`} x={x + CASILLA / 2} y={y + 47}>
                {etiquetaMapa(conexion)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const CeldaConexion = ({
  fila,
  sistema,
  destacada,
}: {
  fila: FilaCobertura;
  sistema: SistemaCobertura;
  destacada: boolean;
}) => (
  <td className={`whitespace-nowrap tabular-nums ${destacada ? "font-semibold" : ""}`}>
    {etiquetaPorcentaje(fila[sistema].porcentaje)}
    <span className="block text-xs font-normal text-tinta-suave">
      {formatoNumero(fila[sistema].conectados)} de {formatoNumero(fila[sistema].aplicables)}
    </span>
  </td>
);

const EncabezadosSistemas = () => (
  <>
    {SISTEMAS_COBERTURA.map((s) => (
      <th key={s} scope="col">
        {DETALLE_SISTEMAS[s].etiqueta}
      </th>
    ))}
    <th scope="col">Sin conexión</th>
  </>
);

const CeldasFila = ({
  fila,
  sistema,
}: {
  fila: FilaCobertura;
  sistema: SistemaCobertura | null;
}) => (
  <>
    {SISTEMAS_COBERTURA.map((s) => (
      <CeldaConexion key={s} fila={fila} sistema={s} destacada={s === sistema} />
    ))}
    <td className="whitespace-nowrap tabular-nums">
      {etiquetaPorcentaje(fila.porcentajeSinConexion)}
      <span className="block text-xs text-tinta-suave">
        {formatoNumero(fila.sinConexion)} de {formatoNumero(fila.registros)}
      </span>
    </td>
  </>
);

/**
 * Datos reales sobre qué información llega a la PDN. Es un componente de servidor sin JavaScript en
 * el cliente: el selector son enlaces y cada cifra del mapa también está en una tabla.
 */
export function CoberturaPdn({
  datos,
  sistema,
  periodo,
  estado,
}: {
  datos: RespuestaCoberturaPdn;
  sistema: SistemaCobertura;
  periodo: string;
  estado: string | null;
}) {
  const { nacional, porAmbito, porEntidad, fuente, avisos, contrasteS3 } = datos;
  const detalle = DETALLE_SISTEMAS[sistema];
  const estados = filasDeEstados(porEntidad);
  const federacion = porEntidad.find((f) => f.entidad === "00");
  const lectura = lecturaDeSistema(estados, sistema);
  const { cero, prioridad, nulo } = textoLectura(lectura, sistema);
  const nombre = (clave: string): string => ESTADOS[clave as ClaveEstado] ?? clave;

  return (
    <div className="space-y-4">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <EtiquetaOrigen origen="pdn" />
        <span>
          Sale del catálogo oficial de entes públicos de la PDN, no de las denuncias sintéticas de
          arriba. Consultado el {fuente.consultadoEl}.
        </span>
      </p>

      <Panel titulo="Para qué sirve">
        <p className="max-w-prose text-sm">
          <strong>Es cobertura de información, no conducta.</strong> Muestra qué tan cerca está la
          PDN de reunir los datos de cada estado, para saber dónde conviene priorizar la integración
          de datos.
        </p>
        <ul className="max-w-prose list-disc space-y-1 pl-5 text-sm">
          <li>
            Si un ente no aparece en S3, eso no significa que no tenga sanciones: significa que,
            según el catálogo, sus datos no llegan a la PDN.
          </li>
          <li>
            Lo mismo en S1, S2 y S6: sin bandera, no sabemos qué declaraciones o contratos existen.
            Sabemos que esa información no se puede consultar aquí.
          </li>
          <li>
            No mide conducta ni riesgo de corrupción. Ninguna cifra habla de un ente concreto.
          </li>
        </ul>
      </Panel>

      <nav aria-label="Sistema de la PDN">
        <p className="mb-2 text-sm font-semibold">Elige un sistema</p>
        <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {SISTEMAS_COBERTURA.map((s) => {
            const activo = s === sistema;
            return (
              <li key={s}>
                <a
                  href={enlaceCobertura(s, periodo, estado)}
                  aria-current={activo ? "true" : undefined}
                  className={`block h-full min-h-11 rounded border p-3 text-sm underline-offset-4 hover:underline ${
                    activo
                      ? "border-marca bg-marca text-marca-tinta"
                      : "border-borde-fuerte bg-superficie"
                  }`}
                >
                  <span className="font-semibold">{DETALLE_SISTEMAS[s].etiqueta}</span>
                  <span className="block text-xs">{DETALLE_SISTEMAS[s].tema}</span>
                  <span className="mt-1 block text-2xl font-semibold tabular-nums">
                    {etiquetaPorcentaje(nacional[s].porcentaje)}
                  </span>
                  <span className="block text-xs tabular-nums">
                    {formatoNumero(nacional[s].conectados)} de{" "}
                    {formatoNumero(nacional[s].aplicables)}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <Panel titulo={`${detalle.etiqueta} por estado: ${detalle.tema}`}>
        <p className="max-w-prose text-sm text-tinta-suave">
          {detalle.descripcion} Se les pide a {detalle.seLePideA}, como en el tablero de la PDN: el
          porcentaje solo cuenta esos registros.
        </p>
        <div className="max-w-prose space-y-2 rounded border border-borde bg-papel p-3 text-sm">
          <p className="font-semibold">Dónde conviene priorizar la integración</p>
          <p>{cero}</p>
          <p>{prioridad}</p>
          {nulo ? <p className="text-tinta-suave">{nulo}</p> : null}
        </div>

        <MapaCobertura filas={estados} sistema={sistema} />
        <p className="text-xs text-tinta-suave sm:hidden">Desliza de lado para ver todo el mapa.</p>
        <ul
          className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-suave"
          aria-label="Leyenda del mapa"
        >
          {LEYENDA.map((m) => (
            <Muestra key={m.clase} clase={m.clase} texto={m.texto} />
          ))}
        </ul>
        <p className="text-xs text-tinta-suave">
          El asterisco marca menos de {UMBRAL_DENOMINADOR_BAJO} registros a los que se les pide el
          sistema. Cada casilla es un estado, con la posición aproximada y el mismo tamaño. La
          Federación no está en el mapa
          {federacion
            ? `: ${formatoNumero(federacion[sistema].conectados)} de ${formatoNumero(federacion[sistema].aplicables)} (${etiquetaPorcentaje(federacion[sistema].porcentaje)})`
            : ""}
          .
        </p>

        <TablaEquivalente resumen="Ver la tabla con los 32 estados y los cuatro sistemas">
          <p className="mb-2 text-xs text-tinta-suave">
            Ordenada de menos a más cobertura en {detalle.etiqueta}.
          </p>
          <TablaDesplazable titulo="Cobertura por estado y sistema">
            <thead>
              <tr>
                <th scope="col">Estado</th>
                <EncabezadosSistemas />
              </tr>
            </thead>
            <tbody>
              {ordenarPorCobertura(estados, sistema).map((f) => (
                <tr key={f.entidad}>
                  <td>{f.nombre}</td>
                  <CeldasFila fila={f} sistema={sistema} />
                </tr>
              ))}
              {federacion ? (
                <tr>
                  <td>{federacion.nombre}</td>
                  <CeldasFila fila={federacion} sistema={sistema} />
                </tr>
              ) : null}
            </tbody>
          </TablaDesplazable>
        </TablaEquivalente>
      </Panel>

      <Panel titulo="Cobertura por ámbito de gobierno">
        <TablaDesplazable titulo="Cobertura por ámbito de gobierno">
          <thead>
            <tr>
              <th scope="col">Ámbito</th>
              <EncabezadosSistemas />
            </tr>
          </thead>
          <tbody>
            {porAmbito.map((f) => (
              <tr key={f.nombre}>
                <td>{f.nombre}</td>
                <CeldasFila fila={f} sistema={sistema} />
              </tr>
            ))}
            <tr>
              <td className="font-semibold">{nacional.nombre}</td>
              <CeldasFila fila={nacional} sistema={sistema} />
            </tr>
          </tbody>
        </TablaDesplazable>
        <p className="text-xs text-tinta-suave">
          «Sin conexión» cuenta los {formatoNumero(nacional.registros)} registros del catálogo:{" "}
          {formatoNumero(nacional.sujetosObligados)} sujetos obligados,{" "}
          {formatoNumero(nacional.organosControl)} órganos internos de control y{" "}
          {formatoNumero(nacional.tribunales)} tribunales. S3 no tiene un proveedor federal general.
        </p>
      </Panel>

      <Panel titulo="Límites, fuente y descarga">
        <ul className="max-w-prose list-disc space-y-1 pl-5 text-sm">
          {avisos.map((aviso) => (
            <li key={aviso}>{aviso}</li>
          ))}
          {contrasteS3.conRegistrosSinConexion.length > 0 ? (
            <li>
              La bandera y los datos no siempre coinciden. La instantánea de S3 sí trae registros de{" "}
              {contrasteS3.conRegistrosSinConexion
                .map((c) => `${nombre(c.estado)} (${formatoNumero(c.registros)})`)
                .join(" y ")}
              , aunque el catálogo no marque ahí ningún registro como conectado
              {contrasteS3.conConexionSinRegistros.length > 0
                ? `; y marca conexiones en ${contrasteS3.conConexionSinRegistros
                    .map((c) => nombre(c.estado))
                    .join(" y ")}, sin registros en esa instantánea`
                : ""}
              .
            </li>
          ) : null}
          <li>
            El k-anonimato no aplica aquí: son conteos de entes públicos, no de denuncias ni de
            personas, y no entran al motor de publicación ni cambian su garantía.
          </li>
        </ul>
        <p className="text-sm">
          <strong>{fuente.nombre}.</strong> Consultado el {fuente.consultadoEl}; última modificación
          registrada en el catálogo: {datos.ultimaModificacion}. Licencia: {fuente.licencia}{" "}
          <span className="break-all text-tinta-suave">{fuente.url}</span>
        </p>
        <ul className="flex flex-wrap gap-3">
          {[
            { href: "/api/v1/publico/descargas/cobertura-pdn.csv", texto: "Cobertura en CSV" },
            { href: "/api/v1/publico/descargas/cobertura-pdn.json", texto: "Cobertura en JSON" },
          ].map((d) => (
            <li key={d.href}>
              <a
                href={d.href}
                download
                className="inline-flex min-h-11 items-center rounded border border-marca px-3 py-1.5 text-sm text-marca underline-offset-4 hover:underline"
              >
                {d.texto}
              </a>
            </li>
          ))}
          <li>
            <a
              href="/api/v1/publico/cobertura-pdn"
              className="inline-flex min-h-11 items-center rounded border border-marca px-3 py-1.5 text-sm text-marca underline-offset-4 hover:underline"
            >
              API de cobertura
            </a>
          </li>
        </ul>
      </Panel>
    </div>
  );
}
