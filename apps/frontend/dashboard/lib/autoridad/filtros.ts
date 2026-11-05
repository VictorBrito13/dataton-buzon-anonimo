import {
  CLAVES_ESTADO,
  CLAVES_ETAPA,
  CLAVES_TIPO_FALTA,
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
