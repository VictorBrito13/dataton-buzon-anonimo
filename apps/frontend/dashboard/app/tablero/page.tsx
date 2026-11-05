import {
  CLAVES_ETAPA,
  CLAVES_ESTADO,
  ETAPAS,
  TIPOS_FALTA,
  esquemaPeriodo,
  type ClaveEstado,
  type Etapa,
  type TipoFalta,
} from "@dataton/shared";
import type { Metadata } from "next";
import { ComoProtegemos } from "@/components/tablero/como-protegemos";
import { ConteosPdn } from "@/components/tablero/conteos-pdn";
import { GraficaBarras, type FilaBarra } from "@/components/tablero/grafica-barras";
import { MapaEstados } from "@/components/tablero/mapa-estados";
import { EtiquetaOrigen, Panel } from "@/components/tablero/piezas";
import {
  IndicadoresEntes,
  PanelMunicipios,
  TablaCruce,
} from "@/components/tablero/tablas-denuncias";
import { obtenerPeriodos, obtenerTablero, type DatosTablero } from "@/lib/tablero/api";
import { ordenarCeldas } from "@/lib/tablero/celdas";
import "./tablero.css";

export const metadata: Metadata = {
  title: "Tablero público",
  description:
    "Estadísticas de denuncias protegidas con k-anonimato, datos abiertos y conteos de la Plataforma Digital Nacional.",
};

const unico = (valor: string | string[] | undefined): string | undefined =>
  Array.isArray(valor) ? valor[0] : valor;

const cargar = async (
  periodoPedido: string | undefined,
  estado: string | null,
): Promise<DatosTablero | "sin_datos" | "sin_servicio"> => {
  try {
    const periodos = await obtenerPeriodos();
    const disponibles = periodos.periodos.map((p) => p.periodo);
    const periodo = esquemaPeriodo.safeParse(periodoPedido).success
      ? (periodoPedido as string)
      : disponibles[0];
    if (!periodo || !disponibles.includes(periodo)) return "sin_datos";
    return await obtenerTablero(periodos, periodo, estado);
  } catch (error) {
    console.error("[tablero]", error);
    return "sin_servicio";
  }
};

export default async function Tablero({ searchParams }: PageProps<"/tablero">) {
  const parametros = await searchParams;
  const estadoPedido = unico(parametros.estado);
  const estado = (CLAVES_ESTADO as readonly string[]).includes(estadoPedido ?? "")
    ? (estadoPedido as ClaveEstado)
    : null;
  const datos = await cargar(unico(parametros.periodo), estado);

  if (datos === "sin_servicio" || datos === "sin_datos") {
    return (
      <>
        <h1 className="text-3xl font-semibold">Tablero público</h1>
        <p role="status" className="mt-4">
          {datos === "sin_servicio"
            ? "No pudimos cargar las estadísticas. Inténtalo de nuevo en unos minutos."
            : "Todavía no hay un trimestre publicado o el que pediste no existe."}
        </p>
      </>
    );
  }

  const { periodo, periodos, estados, tipos, etapas, tiposPorEtapa, municipios } = datos;
  const k = estados.k;

  const filasTipo: FilaBarra[] = ordenarCeldas(tipos.celdas).map((c) => {
    const clave = c.claves.tipoFalta ?? "";
    return {
      clave,
      etiqueta: TIPOS_FALTA[clave as TipoFalta]?.etiqueta ?? clave,
      conteo: c.conteo,
      motivo: c.motivo,
    };
  });
  // Las etapas tienen un orden propio, el del trámite: no se reordenan por tamaño.
  const filasEtapa: FilaBarra[] = (CLAVES_ETAPA as readonly Etapa[]).map((clave) => {
    const celda = etapas.celdas.find((c) => c.claves.etapa === clave);
    return {
      clave,
      etiqueta: ETAPAS[clave].etiqueta,
      conteo: celda ? celda.conteo : 0,
      motivo: celda?.motivo ?? "publicada",
    };
  });

  const descargas = [
    {
      href: `/api/v1/publico/descargas/agregados.csv?periodo=${periodo}`,
      texto: "Agregados en CSV",
    },
    {
      href: `/api/v1/publico/descargas/agregados.json?periodo=${periodo}`,
      texto: "Agregados en JSON",
    },
    { href: "/api/v1/publico/descargas/diccionario.json", texto: "Diccionario de datos" },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold">Tablero público</h1>
        <p className="max-w-prose">
          Cuántas denuncias hay, dónde y en qué etapa van. Ninguna cifra puede señalar a quien
          denunció, y todo lo que ves se puede descargar.
        </p>
        <form
          action="/tablero"
          method="get"
          className="flex flex-wrap items-end gap-3 rounded-md border border-borde bg-superficie p-3"
        >
          <div className="max-w-full min-w-0">
            <label htmlFor="periodo" className="block text-sm font-semibold">
              Trimestre
            </label>
            <select
              id="periodo"
              name="periodo"
              defaultValue={periodo}
              className="mt-1 min-h-11 max-w-full rounded border border-borde-fuerte bg-superficie px-2 py-1.5"
            >
              {periodos.periodos.map((p) => (
                <option key={p.periodo} value={p.periodo}>
                  {p.periodo.replace("-T", ", trimestre ")}
                </option>
              ))}
            </select>
          </div>
          {estado ? <input type="hidden" name="estado" value={estado} /> : null}
          <button
            type="submit"
            className="min-h-11 rounded bg-marca px-4 py-1.5 font-semibold text-marca-tinta"
          >
            Ver trimestre
          </button>
        </form>
      </header>

      <section aria-labelledby="titulo-denuncias" className="space-y-4">
        <div className="space-y-2">
          <h2 id="titulo-denuncias" className="text-2xl font-semibold">
            Denuncias
          </h2>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <EtiquetaOrigen origen="sintetico" />
            <span>
              Todas estas denuncias salen de un generador determinista. No describen hechos reales.
            </span>
          </p>
        </div>

        <p className="text-4xl font-semibold tabular-nums">
          {estados.total === null ? "Oculto" : estados.total.toLocaleString("en-US")}
          <span className="ml-2 text-base font-normal text-tinta-suave">
            denuncias sintéticas en {periodo}
          </span>
        </p>

        <dl className="rounded-md border border-borde bg-superficie p-3 text-sm">
          <dt className="font-semibold">&lt; {k}</dt>
          <dd className="mb-2 text-tinta-suave">
            Hay entre 1 y {k - 1} denuncias. No damos el número exacto porque podría identificar a
            alguien.
          </dd>
          <dt className="font-semibold">Oculta</dt>
          <dd className="text-tinta-suave">
            El número puede ser grande. Se oculta porque, junto con los totales, permitiría calcular
            una celda pequeña.
          </dd>
        </dl>

        <Panel titulo="Denuncias por estado">
          <MapaEstados celdas={estados.celdas} k={k} periodo={periodo} seleccionado={estado} />
        </Panel>

        {estado ? (
          <PanelMunicipios
            estado={estado}
            periodo={periodo}
            municipios={municipios}
            nombres={datos.nombresMunicipios}
            k={k}
          />
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel titulo="Por tipo de falta">
            <GraficaBarras
              titulo="Denuncias por tipo de falta"
              filas={filasTipo}
              k={k}
              encabezadoEtiqueta="Tipo de falta"
            />
          </Panel>
          <Panel titulo="Por etapa del trámite">
            <GraficaBarras
              titulo="Denuncias por etapa"
              filas={filasEtapa}
              k={k}
              encabezadoEtiqueta="Etapa"
            />
          </Panel>
        </div>

        <Panel titulo="Tipo de falta por etapa">
          <TablaCruce cruce={tiposPorEtapa} k={k} />
          <p className="text-xs text-tinta-suave">
            Se publican como máximo dos dimensiones a la vez.
          </p>
        </Panel>

        <Panel titulo="Indicadores por ente">
          <IndicadoresEntes datos={datos.indicadores} />
        </Panel>

        <Panel titulo="Descarga los datos abiertos">
          <p className="text-sm">
            Solo contienen cifras ya protegidas. Las celdas ocultas salen vacías, nunca con su
            valor.
          </p>
          <ul className="flex flex-wrap gap-3">
            {descargas.map((d) => (
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
          </ul>
        </Panel>
      </section>

      <section aria-labelledby="titulo-pdn" className="space-y-4 border-t-4 border-exito pt-6">
        <h2 id="titulo-pdn" className="text-2xl font-semibold">
          Conteos de la Plataforma Digital Nacional
        </h2>
        <ConteosPdn pdn={datos.pdn} estado={estado} periodo={periodo} />
      </section>

      <section aria-labelledby="titulo-proteccion" className="space-y-4 border-t border-borde pt-6">
        <h2 id="titulo-proteccion" className="text-2xl font-semibold">
          Cómo protegemos estas cifras
        </h2>
        <ComoProtegemos metodologia={datos.metodologia} />
      </section>
    </div>
  );
}
