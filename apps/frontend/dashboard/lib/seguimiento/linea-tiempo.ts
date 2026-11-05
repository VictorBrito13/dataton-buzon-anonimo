import { ETAPAS, TRANSICIONES, type Etapa, type RespuestaConsulta } from "@dataton/shared";
import { MESES } from "@/lib/denuncia/relato";

/** Se parte el texto en vez de usar Date: así la zona horaria no puede cambiar el día. */
export const formatearDia = (dia: string): string => {
  const [anio, mes, diaDelMes] = dia.split("-");
  return `${Number(diaDelMes)} de ${MESES[Number(mes) - 1]} de ${anio}`;
};

const describirEtapa = (etapa: Etapa) => ({
  etapa,
  etiqueta: ETAPAS[etapa].etiqueta,
  explicacion: ETAPAS[etapa].explicacion,
  plazoEsperado: ETAPAS[etapa].plazoEsperado,
});

export const construirLineaTiempo = (
  consulta: Pick<RespuestaConsulta, "etapaActual" | "lineaTiempo">,
) => {
  const ordenadas = [...consulta.lineaTiempo].sort((a, b) => a.dia.localeCompare(b.dia));
  return {
    pasadas: ordenadas.map(({ etapa, dia }, i) => ({
      ...describirEtapa(etapa),
      dia,
      diaLegible: formatearDia(dia),
      actual: etapa === consulta.etapaActual && i === ordenadas.length - 1,
    })),
    siguientes: TRANSICIONES[consulta.etapaActual].map(describirEtapa),
    concluida: ETAPAS[consulta.etapaActual].terminal,
  };
};

export const describirMensajes = (mensajes: RespuestaConsulta["mensajes"]) =>
  mensajes.map(({ autor, dia, cuerpo }) => ({
    autor,
    autorLegible: autor === "autoridad" ? "La autoridad" : "Tú",
    diaLegible: formatearDia(dia),
    texto:
      cuerpo ?? "Mensaje sellado. Solo la autoridad puede leerlo; ni siquiera aquí se puede abrir.",
  }));

const RUTA: readonly Etapa[] = [
  "recibida",
  "turnada_investigadora",
  "analisis_competencia",
  "en_investigacion",
  "substanciacion",
  "tribunal",
  "resuelta",
];
const CIERRES: readonly Etapa[] = ["sin_competencia", "archivada"];

/** Lo que sigue tras denunciar, para mostrarlo antes y después del envío. */
export const procesoDespuesDeDenunciar = () => ({
  ruta: RUTA.map(describirEtapa),
  cierresAnticipados: CIERRES.map(describirEtapa),
});
