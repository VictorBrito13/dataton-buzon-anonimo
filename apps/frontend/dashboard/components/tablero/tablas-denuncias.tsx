import {
  CLAVES_ETAPA,
  ESTADOS,
  ETAPAS,
  TIPOS_FALTA,
  type ClaveEstado,
  type Etapa,
  type RespuestaAgregados,
  type RespuestaIndicadores,
  type RespuestaMunicipios,
  type TipoFalta,
} from "@dataton/shared";
import { etiquetaConteo, ordenarCeldas } from "@/lib/tablero/celdas";
import { Panel, TablaDesplazable } from "./piezas";

export function PanelMunicipios({
  estado,
  periodo,
  municipios,
  nombres,
  k,
}: {
  estado: ClaveEstado;
  periodo: string;
  municipios: RespuestaAgregados;
  nombres: RespuestaMunicipios | null;
  k: number;
}) {
  const nombrePorClave = new Map(nombres?.municipios.map((m) => [m.clave, m.nombre]));
  const propias = municipios.celdas.filter((c) => c.claves.municipio?.startsWith(estado));
  const conDatos = ordenarCeldas(propias.filter((c) => c.conteo !== 0));
  const enCero = propias.length - conDatos.length;

  return (
    <Panel titulo={`Municipios de ${ESTADOS[estado]}`} id="municipios">
      <p className="text-sm text-tinta-suave">
        {enCero} municipios sin denuncias en {periodo} no se listan.{" "}
        <a className="text-marca underline underline-offset-4" href={`/tablero?periodo=${periodo}`}>
          Cerrar municipios
        </a>
      </p>
      <TablaDesplazable titulo={`Denuncias por municipio en ${ESTADOS[estado]}`}>
        <thead>
          <tr>
            <th scope="col">Municipio</th>
            <th scope="col">Denuncias</th>
          </tr>
        </thead>
        <tbody>
          {conDatos.map((celda) => {
            const clave = celda.claves.municipio ?? "";
            return (
              <tr key={clave}>
                <td>
                  {clave.endsWith("999")
                    ? "Sin municipio indicado"
                    : (nombrePorClave.get(clave) ?? clave)}
                </td>
                <td className="tabular-nums">{etiquetaConteo(celda, k)}</td>
              </tr>
            );
          })}
        </tbody>
      </TablaDesplazable>
      <p className="text-xs text-tinta-suave">{nombres?.fuente}</p>
    </Panel>
  );
}

const ETAPAS_CORTAS = CLAVES_ETAPA as readonly Etapa[];

/** Cruce de dos dimensiones: aquí se ve la supresión complementaria en acción. */
export function TablaCruce({ cruce, k }: { cruce: RespuestaAgregados; k: number }) {
  const tipos = [...new Set(cruce.celdas.map((c) => c.claves.tipoFalta ?? ""))].sort();
  const valor = (tipo: string, etapa: string): string => {
    const celda = cruce.celdas.find((c) => c.claves.tipoFalta === tipo && c.claves.etapa === etapa);
    return celda ? etiquetaConteo(celda, k) : "0";
  };
  return (
    <TablaDesplazable titulo="Denuncias por tipo de falta y etapa">
      <thead>
        <tr>
          <th scope="col">Tipo de falta</th>
          {ETAPAS_CORTAS.map((etapa) => (
            <th scope="col" key={etapa}>
              {ETAPAS[etapa].etiqueta}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tipos.map((tipo) => (
          <tr key={tipo}>
            <th scope="row" className="min-w-40">
              {TIPOS_FALTA[tipo as TipoFalta]?.etiqueta ?? tipo}
            </th>
            {ETAPAS_CORTAS.map((etapa) => (
              <td key={etapa} className="tabular-nums">
                {valor(tipo, etapa)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </TablaDesplazable>
  );
}

const porciento = (valor: number | null): string => (valor === null ? "Oculto" : `${valor} %`);

const SENALES = {
  priorizar_revision: "Revisar primero",
  sin_senal: "Sin señal",
  datos_insuficientes: "Datos insuficientes",
} as const;

/** El total del ente, con el mismo criterio que las celdas: "< k" solo si de verdad es menor que k. */
export const etiquetaDenuncias = (
  { denuncias, motivo }: Pick<RespuestaIndicadores["entes"][number], "denuncias" | "motivo">,
  k: number,
): string =>
  etiquetaConteo(
    { conteo: denuncias, motivo: motivo === "menor_a_k" ? motivo : "supresion_complementaria" },
    k,
  );

export function IndicadoresEntes({ datos }: { datos: RespuestaIndicadores }) {
  const { entes, aviso, k } = datos;
  const conEtapaOculta = entes.some((e) => e.motivo === "etapa_oculta");
  return (
    <>
      <p role="note" className="rounded border border-aviso bg-aviso-suave p-3 text-sm text-aviso">
        <strong>{aviso}</strong> Estos entes son ficticios y sus cifras, sintéticas. No representan
        a ninguna institución real.
      </p>
      <TablaDesplazable titulo="Indicadores por ente ficticio">
        <thead>
          <tr>
            <th scope="col">Ente</th>
            <th scope="col">Denuncias</th>
            <th scope="col">Con respuesta</th>
            <th scope="col">Turnado</th>
            <th scope="col">Archivado</th>
            <th scope="col">Sin competencia</th>
            <th scope="col">Días en recepción</th>
            <th scope="col">Días en investigación</th>
            <th scope="col">Señal</th>
          </tr>
        </thead>
        <tbody>
          {entes.map((e) => (
            <tr key={e.ente}>
              <th scope="row" className="min-w-40">
                {e.etiqueta}
              </th>
              <td className="tabular-nums">{etiquetaDenuncias(e, k)}</td>
              <td className="tabular-nums">{porciento(e.porcentajeConRespuesta)}</td>
              <td className="tabular-nums">{porciento(e.porcentajeTurnado)}</td>
              <td className="tabular-nums">{porciento(e.porcentajeArchivado)}</td>
              <td className="tabular-nums">{porciento(e.porcentajeSinCompetencia)}</td>
              <td className="tabular-nums">{e.tiempoPromedioDias.recibida ?? "Oculto"}</td>
              <td className="tabular-nums">{e.tiempoPromedioDias.en_investigacion ?? "Oculto"}</td>
              <td>{SENALES[e.senal]}</td>
            </tr>
          ))}
        </tbody>
      </TablaDesplazable>
      <p className="text-xs text-tinta-suave">
        «Revisar primero» significa que menos de la mitad de las denuncias tuvo respuesta en la
        fecha de corte. Un porcentaje se oculta si con él se pudieran despejar menos de {k} casos.
        «Oculta» en Denuncias es un total que se retiró para impedir una resta, no un total menor
        que {k}.
        {conEtapaOculta &&
          " Cuando alguna etapa de un ente está oculta en la tabla, sus porcentajes, tiempos y señal se omiten: describirían esa celda."}
      </p>
    </>
  );
}
