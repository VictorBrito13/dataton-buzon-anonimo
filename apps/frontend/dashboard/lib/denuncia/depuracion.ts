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

export const reemplazarHallazgo = (
  texto: string,
  hallazgos: readonly Hallazgo[],
  objetivo: Hallazgo,
): { texto: string; hallazgos: Hallazgo[] } => {
  const resto = hallazgos.filter((h) => h !== objetivo);
  if (texto.slice(objetivo.inicio, objetivo.fin) !== objetivo.texto) {
    return { texto, hallazgos: resto };
  }
  const desplazamiento = objetivo.sugerencia.length - (objetivo.fin - objetivo.inicio);
  return {
    texto: texto.slice(0, objetivo.inicio) + objetivo.sugerencia + texto.slice(objetivo.fin),
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
