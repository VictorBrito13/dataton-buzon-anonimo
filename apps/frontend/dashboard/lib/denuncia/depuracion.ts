import type { Hallazgo } from "@/lib/privacidad";

/** La decisión siempre es de la persona: aquí solo se ubica, reemplaza o recuerda lo que eligió. */
export interface Segmento {
  texto: string;
  hallazgo?: Hallazgo;
}

const ordenar = (hallazgos: readonly Hallazgo[]) =>
  [...hallazgos].sort((a, b) => a.inicio - b.inicio || b.fin - a.fin);

export const segmentarTexto = (texto: string, hallazgos: readonly Hallazgo[]): Segmento[] => {
  const segmentos: Segmento[] = [];
  let cursor = 0;
  for (const hallazgo of ordenar(hallazgos)) {
    if (hallazgo.inicio < cursor) continue;
    if (hallazgo.inicio > cursor) segmentos.push({ texto: texto.slice(cursor, hallazgo.inicio) });
    segmentos.push({ texto: texto.slice(hallazgo.inicio, hallazgo.fin), hallazgo });
    cursor = hallazgo.fin;
  }
  if (cursor < texto.length || segmentos.length === 0) {
    segmentos.push({ texto: texto.slice(cursor) });
  }
  return segmentos;
};

/** Lo que puede ir entre el fin de una oración y su primera palabra. */
const APERTURA_AL_FINAL = /[\p{Zs}\t¿¡«"“'(]+$/u;

const iniciaOracion = (texto: string, posicion: number): boolean => {
  const previo = texto.slice(0, posicion).replace(APERTURA_AL_FINAL, "");
  return previo === "" || /[.!?…\n\r]$/.test(previo);
};

/** Las sugerencias vienen en minúscula: dependen de dónde caigan para leerse como oración. */
export const sugerenciaEnContexto = (texto: string, hallazgo: Hallazgo): string => {
  const { sugerencia } = hallazgo;
  if (!/^\p{Lu}/u.test(hallazgo.texto) && !iniciaOracion(texto, hallazgo.inicio)) {
    return sugerencia;
  }
  return sugerencia.charAt(0).toLocaleUpperCase("es-MX") + sugerencia.slice(1);
};

export const reemplazarHallazgo = (
  texto: string,
  hallazgos: readonly Hallazgo[],
  objetivo: Hallazgo,
): { texto: string; hallazgos: Hallazgo[] } => {
  const resto = hallazgos.filter((h) => h !== objetivo);
  if (texto.slice(objetivo.inicio, objetivo.fin) !== objetivo.texto) {
    return { texto, hallazgos: resto };
  }
  const sugerencia = sugerenciaEnContexto(texto, objetivo);
  const desplazamiento = sugerencia.length - (objetivo.fin - objetivo.inicio);
  return {
    texto: texto.slice(0, objetivo.inicio) + sugerencia + texto.slice(objetivo.fin),
    hallazgos: resto
      .filter((h) => h.fin <= objetivo.inicio || h.inicio >= objetivo.fin)
      .map((h) =>
        h.inicio >= objetivo.fin
          ? { ...h, inicio: h.inicio + desplazamiento, fin: h.fin + desplazamiento }
          : h,
      ),
  };
};

export const claveIgnorado = (hallazgo: Hallazgo): string => `${hallazgo.tipo}:${hallazgo.texto}`;

export const quitarIgnorados = (
  hallazgos: readonly Hallazgo[],
  ignorados: readonly string[],
): Hallazgo[] => hallazgos.filter((h) => !ignorados.includes(claveIgnorado(h)));
