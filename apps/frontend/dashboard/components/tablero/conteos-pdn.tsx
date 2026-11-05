import { ESTADOS, type ClaveEstado, type RespuestaPdn } from "@dataton/shared";
import { formatoNumero } from "@/lib/tablero/celdas";
import { EtiquetaOrigen, Panel, TablaDesplazable } from "./piezas";

const MAX_INSTITUCIONES = 15;

const nombreEstado = (clave: string): string => ESTADOS[clave as ClaveEstado] ?? clave;

/** Cifras reales, separadas de las sintéticas. Conteos por institución, nunca registros. */
export function ConteosPdn({
  pdn,
  estado,
  periodo,
}: {
  pdn: RespuestaPdn;
  estado: string | null;
  periodo: string;
}) {
  const { s3, s6, cruce, advertencias, fuentes } = pdn;
  const umbral = s3.umbralPorInstitucion;
  return (
    <div className="space-y-4">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <EtiquetaOrigen origen="pdn" />
        <span>
          Estas cifras sí son reales y no se relacionan con las denuncias sintéticas de arriba.
        </span>
      </p>
      <ul className="list-disc space-y-1 rounded border border-aviso bg-aviso-suave p-3 pl-7 text-sm text-aviso">
        {advertencias.map((texto) => (
          <li key={texto}>{texto}</li>
        ))}
      </ul>

      <Panel titulo="Registros de S3 (sancionados) por estado">
        <TablaDesplazable titulo="Registros de S3 por estado">
          <thead>
            <tr>
              <th scope="col">Estado</th>
              <th scope="col">Registros</th>
              <th scope="col">Instituciones</th>
            </tr>
          </thead>
          <tbody>
            {[...s3.porEstado]
              .sort((a, b) => b.registros - a.registros)
              .map((fila) => (
                <tr key={fila.estado}>
                  <td>
                    <a
                      className="underline underline-offset-4"
                      href={`/tablero?periodo=${periodo}&estado=${fila.estado}#pdn-instituciones`}
                    >
                      {nombreEstado(fila.estado)}
                    </a>
                  </td>
                  <td className="tabular-nums">{formatoNumero(fila.registros)}</td>
                  <td className="tabular-nums">{formatoNumero(fila.instituciones)}</td>
                </tr>
              ))}
          </tbody>
        </TablaDesplazable>
        <p className="text-xs text-tinta-suave">
          Solo aparecen los estados con registros en este corte. Quedan fuera{" "}
          {formatoNumero(s3.registrosSinInstitucion)} registros sin institución y otros{" "}
          {formatoNumero(s3.registrosConNombreNoInterpretable)} cuyo campo de institución contiene
          un código o un cargo. La carpeta «Mexico» del proveedor se interpretó como Estado de
          México.
        </p>
      </Panel>

      {estado ? (
        <Panel
          titulo={`Instituciones con registros en S3: ${nombreEstado(estado)}`}
          id="pdn-instituciones"
        >
          {s3.instituciones.length === 0 ? (
            <p className="text-sm">Sin registros de este estado en el corte de S3.</p>
          ) : (
            <TablaDesplazable titulo={`Registros de S3 por institución en ${nombreEstado(estado)}`}>
              <thead>
                <tr>
                  <th scope="col">Institución (nombre como aparece en S3)</th>
                  <th scope="col">Registros</th>
                </tr>
              </thead>
              <tbody>
                {s3.instituciones.slice(0, MAX_INSTITUCIONES).map((i) => (
                  <tr key={i.nombre}>
                    <td>{i.nombre}</td>
                    <td className="tabular-nums">
                      {i.conteo === null ? `< ${umbral}` : formatoNumero(i.conteo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TablaDesplazable>
          )}
          {s3.instituciones.length > MAX_INSTITUCIONES ? (
            <p className="text-xs text-tinta-suave">
              Se muestran {MAX_INSTITUCIONES} de {s3.instituciones.length} nombres.
            </p>
          ) : null}
        </Panel>
      ) : null}

      <Panel titulo="Procedimientos de contratación en S6, hasta 2021">
        <p className="text-sm">
          {formatoNumero(s6.procedimientos)} procedimientos de {formatoNumero(s6.compradores)}{" "}
          instituciones compradoras. Contratar no implica ninguna irregularidad: es una medida de
          volumen.
        </p>
        <TablaDesplazable titulo="Instituciones con más procedimientos en S6">
          <thead>
            <tr>
              <th scope="col">Institución compradora</th>
              <th scope="col">Procedimientos</th>
            </tr>
          </thead>
          <tbody>
            {s6.mayores.map((c) => (
              <tr key={c.nombre}>
                <td>{c.nombre}</td>
                <td className="tabular-nums">{formatoNumero(c.procedimientos)}</td>
              </tr>
            ))}
          </tbody>
        </TablaDesplazable>
      </Panel>

      <Panel titulo="Cruce por nombre entre S3 y S6: prueba de concepto">
        <p className="text-sm">
          Solo cuenta como cruce el mismo nombre en la misma jurisdicción, según Cobertura.
          Resultado: <strong>{cruce.coincidencias.length} coincidencias</strong>,{" "}
          {cruce.homonimosDescartados} homónimos descartados y {cruce.sinJurisdiccionConocida}{" "}
          nombres sin jurisdicción conocida. S3 no tiene proveedor federal y S6 es sobre todo
          federal, así que por ahora hay muy poco que cruzar. Los entes ficticios de este tablero no
          se cruzan con instituciones reales.
        </p>
        {cruce.coincidencias.length > 0 ? (
          <TablaDesplazable titulo="Coincidencias entre S3 y S6">
            <thead>
              <tr>
                <th scope="col">Institución</th>
                <th scope="col">Estado</th>
                <th scope="col">Registros S3</th>
                <th scope="col">Procedimientos S6</th>
              </tr>
            </thead>
            <tbody>
              {cruce.coincidencias.map((c) => (
                <tr key={`${c.estado}-${c.nombre}`}>
                  <td>{c.nombre}</td>
                  <td>{nombreEstado(c.estado)}</td>
                  <td className="tabular-nums">
                    {c.sanciones === null ? `< ${umbral}` : formatoNumero(c.sanciones)}
                  </td>
                  <td className="tabular-nums">{formatoNumero(c.procedimientos)}</td>
                </tr>
              ))}
            </tbody>
          </TablaDesplazable>
        ) : null}
      </Panel>

      <Panel titulo="Fuentes y fechas">
        <ul className="space-y-2 text-sm">
          {fuentes.map((f) => (
            <li key={f.nombre}>
              <strong>{f.nombre}.</strong> Consultado el {f.consultadoEl}.{" "}
              {f.cobertura ? `${f.cobertura} ` : ""}
              Licencia: {f.licencia} <span className="break-all text-tinta-suave">{f.url}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-tinta-suave">
          El tablero lee estos conteos de archivos del repositorio: no llama a terceros al
          mostrarse.
        </p>
      </Panel>
    </div>
  );
}
