"use client";

import "@dataton/shared";
import { CLAVES_ETAPA, CLAVES_TIPO_FALTA, ESTADOS, ETAPAS, TIPOS_FALTA } from "@dataton/shared";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { listarDenuncias } from "@/lib/autoridad/api";
import {
  FILTROS_VACIOS,
  OPCIONES_ESTADO,
  cambiarFiltro,
  cambiarPagina,
  consultaDeFiltros,
  describirPagina,
  filtrosAConsulta,
  leerFiltros,
  totalPaginas,
  type Filtros,
} from "@/lib/autoridad/filtros";
import { ALERTA, BOTON_SECUNDARIO, CAMPO, CELDA, CELDA_TITULO, ETIQUETA, SECCION } from "./estilos";
import { useCarga } from "./use-carga";
import { useNombres } from "./use-nombres";

type Opcion = { valor: string; texto: string };

const OPCIONES_ETAPA: Opcion[] = CLAVES_ETAPA.map((valor) => ({
  valor,
  texto: ETAPAS[valor].etiqueta,
}));
const OPCIONES_TIPO: Opcion[] = CLAVES_TIPO_FALTA.map((valor) => ({
  valor,
  texto: TIPOS_FALTA[valor].etiqueta,
}));

function Selector(props: {
  id: string;
  etiqueta: string;
  opciones: Opcion[];
  valor: string | null;
  alCambiar: (valor: string) => void;
}) {
  return (
    <div className="min-w-[min(12rem,100%)] flex-1">
      <label htmlFor={props.id} className={ETIQUETA}>
        {props.etiqueta}
      </label>
      <select
        id={props.id}
        className={CAMPO}
        value={props.valor ?? ""}
        onChange={(e) => props.alCambiar(e.target.value)}
      >
        <option value="">Todas</option>
        {props.opciones.map(({ valor, texto }) => (
          <option key={valor} value={valor}>
            {texto}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Anterior y siguiente, con la posición a la vista; con una sola página no aparece. */
function Paginacion(props: { pagina: number; paginas: number; irA: (pagina: number) => void }) {
  const { pagina, paginas, irA } = props;
  if (paginas <= 1) return null;
  return (
    <nav aria-label="Páginas del listado" className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className={BOTON_SECUNDARIO}
        disabled={pagina <= 1}
        onClick={() => irA(pagina - 1)}
      >
        Página anterior
      </button>
      <span className="text-sm text-tinta-suave" aria-current="page">
        Página {pagina} de {paginas}
      </span>
      <button
        type="button"
        className={BOTON_SECUNDARIO}
        disabled={pagina >= paginas}
        onClick={() => irA(pagina + 1)}
      >
        Página siguiente
      </button>
    </nav>
  );
}

export function ListaDenuncias() {
  const ruta = usePathname();
  const consulta = useSearchParams();
  const filtros = useMemo(() => leerFiltros(consulta), [consulta]);
  // Filtrar y paginar ocurre en el servidor: cada cambio en la URL vuelve a pedir el listado.
  const cargar = useCallback(
    (signal: AbortSignal) => listarDenuncias(consultaDeFiltros(filtros), signal),
    [filtros],
  );
  const { datos, error, cargando, recargar } = useCarga(cargar);
  const nombres = useNombres();

  /** En la URL, sin recargar la página: volver desde un detalle conserva filtros y página. */
  const aplicar = useCallback(
    (nuevos: Filtros) => {
      const siguiente = filtrosAConsulta(nuevos);
      window.history.replaceState(null, "", siguiente ? `${ruta}?${siguiente}` : ruta);
    },
    [ruta],
  );

  const paginas = datos ? totalPaginas(datos.total, datos.porPagina) : 1;

  // Si al filtrar la página pedida quedó más allá del final, se va a la última que existe.
  useEffect(() => {
    if (datos && datos.total > 0 && datos.denuncias.length === 0 && filtros.pagina > paginas) {
      aplicar(cambiarPagina(filtros, paginas));
    }
  }, [datos, filtros, paginas, aplicar]);

  const hayFiltros = filtrosAConsulta({ ...filtros, pagina: 1 }) !== "";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Denuncias recibidas</h1>

      <form
        aria-label="Filtros"
        className={`${SECCION} flex flex-wrap items-end gap-3`}
        onSubmit={(e) => e.preventDefault()}
      >
        <Selector
          id="filtro-etapa"
          etiqueta="Etapa"
          opciones={OPCIONES_ETAPA}
          valor={filtros.etapa}
          alCambiar={(valor) => aplicar(cambiarFiltro(filtros, "etapa", valor))}
        />
        <Selector
          id="filtro-estado"
          etiqueta="Estado"
          opciones={OPCIONES_ESTADO}
          valor={filtros.estado}
          alCambiar={(valor) => aplicar(cambiarFiltro(filtros, "estado", valor))}
        />
        <Selector
          id="filtro-tipo"
          etiqueta="Tipo de falta"
          opciones={OPCIONES_TIPO}
          valor={filtros.tipoFalta}
          alCambiar={(valor) => aplicar(cambiarFiltro(filtros, "tipoFalta", valor))}
        />
        <button
          type="button"
          className={BOTON_SECUNDARIO}
          disabled={!hayFiltros}
          onClick={() => aplicar(FILTROS_VACIOS)}
        >
          Limpiar filtros
        </button>
      </form>

      {error && (
        <div role="alert" className={`${ALERTA} flex flex-wrap items-center gap-3`}>
          <span>{error}</span>
          <button type="button" className={BOTON_SECUNDARIO} onClick={recargar}>
            Reintentar
          </button>
        </div>
      )}

      <p role="status" className="text-sm text-tinta-suave">
        {datos
          ? describirPagina({
              enPagina: datos.denuncias.length,
              pagina: datos.pagina,
              porPagina: datos.porPagina,
              total: datos.total,
            })
          : cargando
            ? "Cargando denuncias…"
            : ""}
      </p>

      {datos && (
        <div
          role="region"
          aria-label="Tabla de denuncias"
          tabIndex={0}
          className="overflow-x-auto rounded-sm border border-borde bg-superficie"
        >
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Denuncias recibidas, de la más reciente a la más antigua. No incluyen datos de quien
              denuncia.
            </caption>
            <thead>
              <tr>
                <th scope="col" className={CELDA_TITULO}>
                  Expediente
                </th>
                <th scope="col" className={CELDA_TITULO}>
                  Recibida
                </th>
                <th scope="col" className={CELDA_TITULO}>
                  Etapa
                </th>
                <th scope="col" className={CELDA_TITULO}>
                  Estado
                </th>
                <th scope="col" className={CELDA_TITULO}>
                  Municipio
                </th>
                <th scope="col" className={CELDA_TITULO}>
                  Tipo de falta
                </th>
                <th scope="col" className={CELDA_TITULO}>
                  Ente
                </th>
              </tr>
            </thead>
            <tbody>
              {datos.denuncias.map((denuncia) => (
                <tr key={denuncia.id}>
                  <td className={CELDA}>
                    <Link
                      href={`/autoridad/denuncias/${denuncia.id}`}
                      className="font-mono text-marca underline underline-offset-2"
                    >
                      {denuncia.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className={`${CELDA} whitespace-nowrap`}>
                    <time dateTime={denuncia.recibidaDia}>{denuncia.recibidaDia}</time>
                  </td>
                  <td className={CELDA}>{ETAPAS[denuncia.etapa].etiqueta}</td>
                  <td className={CELDA}>{ESTADOS[denuncia.estado]}</td>
                  <td className={CELDA}>{nombres.municipio(denuncia.municipio)}</td>
                  <td className={CELDA}>{TIPOS_FALTA[denuncia.tipoFalta].etiqueta}</td>
                  <td className={CELDA}>{nombres.ente(denuncia.enteId)}</td>
                </tr>
              ))}
              {datos.denuncias.length === 0 && (
                <tr>
                  <td colSpan={7} className={`${CELDA} text-tinta-suave`}>
                    Ninguna denuncia coincide con estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {datos && (
        <Paginacion
          pagina={datos.pagina}
          paginas={paginas}
          irA={(pagina) => aplicar(cambiarPagina(filtros, pagina))}
        />
      )}
    </div>
  );
}
