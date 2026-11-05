import {
  CLAVES_ESTADO,
  CLAVES_ETAPA,
  CLAVES_TIPO_FALTA,
  ESTADOS,
  LISTADO_AUTORIDAD,
  type ClaveEstado,
  type ConsultaListadoAutoridad,
  type Etapa,
  type TipoFalta,
} from "@dataton/shared";

/** Lo que la persona eligió, incluida la página: vive en la URL para sobrevivir a la navegación. */
export type Filtros = {
  etapa: Etapa | null;
  estado: ClaveEstado | null;
  tipoFalta: TipoFalta | null;
  pagina: number;
};

/** Del catálogo, no de los resultados: siempre los 32 y en un orden que se puede recorrer a ojo. */
export const OPCIONES_ESTADO: { valor: ClaveEstado; texto: string }[] = CLAVES_ESTADO.map(
  (valor) => ({ valor, texto: ESTADOS[valor] }),
).sort((a, b) => a.texto.localeCompare(b.texto, "es"));

export const FILTROS_VACIOS: Filtros = { etapa: null, estado: null, tipoFalta: null, pagina: 1 };

const deCatalogo = <T extends string>(catalogo: readonly T[], valor: string | null): T | null =>
  catalogo.find((clave) => clave === valor) ?? null;

/** Solo enteros dentro del rango del contrato; cualquier otra cosa es la primera página. */
const paginaDe = (valor: string | null): number => {
  if (valor === null || !/^\d+$/.test(valor)) return 1;
  const numero = Number(valor);
  return numero >= 1 && numero <= LISTADO_AUTORIDAD.paginaMaxima ? numero : 1;
};

/** Solo valores de catálogo: la consulta de la URL no es de fiar. */
export const leerFiltros = (consulta: Pick<URLSearchParams, "get">): Filtros => ({
  etapa: deCatalogo(CLAVES_ETAPA, consulta.get("etapa")),
  estado: deCatalogo(CLAVES_ESTADO, consulta.get("estado")),
  tipoFalta: deCatalogo(CLAVES_TIPO_FALTA, consulta.get("tipo")),
  pagina: paginaDe(consulta.get("pagina")),
});

const PARAMETROS = { etapa: "etapa", estado: "estado", tipoFalta: "tipo" } as const;
type CampoFiltro = keyof typeof PARAMETROS;

/** Lo que eligió la persona pasa por la misma validación que la URL. Cambiar un filtro reinicia la página. */
export const cambiarFiltro = (filtros: Filtros, campo: CampoFiltro, valor: string): Filtros => ({
  ...filtros,
  [campo]: leerFiltros(new URLSearchParams({ [PARAMETROS[campo]]: valor }))[campo],
  pagina: 1,
});

export const cambiarPagina = (filtros: Filtros, pagina: number): Filtros => ({
  ...filtros,
  pagina: Math.max(1, Math.trunc(pagina)),
});

export const filtrosAConsulta = ({ etapa, estado, tipoFalta, pagina }: Filtros): string => {
  const consulta = new URLSearchParams();
  if (etapa) consulta.set("etapa", etapa);
  if (estado) consulta.set("estado", estado);
  if (tipoFalta) consulta.set("tipo", tipoFalta);
  if (pagina > 1) consulta.set("pagina", String(pagina));
  return consulta.toString();
};

/** Lo que se pide a la API: el tamaño de página lo decide el servidor. */
export const consultaDeFiltros = ({
  etapa,
  estado,
  tipoFalta,
  pagina,
}: Filtros): Omit<ConsultaListadoAutoridad, "porPagina"> => ({
  pagina,
  ...(etapa ? { etapa } : {}),
  ...(estado ? { estado } : {}),
  ...(tipoFalta ? { tipoFalta } : {}),
});

export const totalPaginas = (total: number, porPagina: number): number =>
  Math.max(1, Math.ceil(total / porPagina));

const FORMATO = new Intl.NumberFormat("es-MX");

/** El servidor pagina y filtra: aquí solo se dice qué tramo se ve y cuántas hay en total. */
export const describirPagina = ({
  enPagina,
  pagina,
  porPagina,
  total,
}: {
  enPagina: number;
  pagina: number;
  porPagina: number;
  total: number;
}): string => {
  if (total === 0) return "Sin denuncias para estos filtros";
  if (total <= porPagina) return `${enPagina} de ${total} denuncias`;
  const paginas = totalPaginas(total, porPagina);
  if (pagina > paginas) return `Esta página ya no existe. Hay ${FORMATO.format(paginas)} páginas.`;
  const inicio = (pagina - 1) * porPagina + 1;
  const fin = inicio + enPagina - 1;
  return `Denuncias ${FORMATO.format(inicio)} a ${FORMATO.format(fin)} de ${FORMATO.format(total)}. Página ${FORMATO.format(pagina)} de ${FORMATO.format(paginas)}.`;
};
