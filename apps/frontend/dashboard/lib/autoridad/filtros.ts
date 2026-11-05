import {
  CLAVES_ESTADO,
  CLAVES_ETAPA,
  CLAVES_TIPO_FALTA,
  ESTADOS,
  type ClaveEstado,
  type Etapa,
  type ResumenDenunciaAutoridad,
  type TipoFalta,
} from "@dataton/shared";

export type Filtros = {
  etapa: Etapa | null;
  estado: ClaveEstado | null;
  tipoFalta: TipoFalta | null;
};

/** Del catálogo, no de los resultados: siempre los 32 y en un orden que se puede recorrer a ojo. */
export const OPCIONES_ESTADO: { valor: ClaveEstado; texto: string }[] = CLAVES_ESTADO.map(
  (valor) => ({ valor, texto: ESTADOS[valor] }),
).sort((a, b) => a.texto.localeCompare(b.texto, "es"));

export const FILTROS_VACIOS: Filtros = { etapa: null, estado: null, tipoFalta: null };

const deCatalogo = <T extends string>(catalogo: readonly T[], valor: string | null): T | null =>
  catalogo.find((clave) => clave === valor) ?? null;

/** Solo valores de catálogo: la consulta de la URL no es de fiar. */
export const leerFiltros = (consulta: Pick<URLSearchParams, "get">): Filtros => ({
  etapa: deCatalogo(CLAVES_ETAPA, consulta.get("etapa")),
  estado: deCatalogo(CLAVES_ESTADO, consulta.get("estado")),
  tipoFalta: deCatalogo(CLAVES_TIPO_FALTA, consulta.get("tipo")),
});

const PARAMETROS = { etapa: "etapa", estado: "estado", tipoFalta: "tipo" } as const;

/** Lo que eligió la persona pasa por la misma validación que la URL. */
export const cambiarFiltro = (filtros: Filtros, campo: keyof Filtros, valor: string): Filtros => ({
  ...filtros,
  [campo]: leerFiltros(new URLSearchParams({ [PARAMETROS[campo]]: valor }))[campo],
});

export const filtrosAConsulta = ({ etapa, estado, tipoFalta }: Filtros): string => {
  const consulta = new URLSearchParams();
  if (etapa) consulta.set("etapa", etapa);
  if (estado) consulta.set("estado", estado);
  if (tipoFalta) consulta.set("tipo", tipoFalta);
  return consulta.toString();
};

export const filtrarDenuncias = (
  denuncias: readonly ResumenDenunciaAutoridad[],
  { etapa, estado, tipoFalta }: Filtros,
): ResumenDenunciaAutoridad[] =>
  denuncias
    .filter(
      (denuncia) =>
        (!etapa || denuncia.etapa === etapa) &&
        (!estado || denuncia.estado === estado) &&
        (!tipoFalta || denuncia.tipoFalta === tipoFalta),
    )
    .sort((a, b) => b.recibidaDia.localeCompare(a.recibidaDia));

const FORMATO = new Intl.NumberFormat("es-MX");

/** Filtrar ocurre en el navegador: si el servidor recortó la lista, hay que decir qué no se ve. */
export const describirListado = ({
  visibles,
  cargadas,
  total,
}: {
  visibles: number;
  cargadas: number;
  total: number;
}): string => {
  if (cargadas >= total) return `${visibles} de ${cargadas} denuncias`;
  const recientes = `las ${FORMATO.format(cargadas)} denuncias más recientes de ${FORMATO.format(total)}`;
  const inicio =
    visibles === cargadas
      ? `Se muestran ${recientes}`
      : `${FORMATO.format(visibles)} coinciden entre ${recientes}`;
  return `${inicio}. Los filtros solo buscan entre esas ${FORMATO.format(cargadas)}.`;
};
