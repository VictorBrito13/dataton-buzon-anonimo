import type { Hallazgo, TipoHallazgo } from "./hallazgo";

/**
 * Capa 2, parte pura: convierte la salida del modelo en hallazgos. El modelo
 * solo da etiquetas por token, sin posiciones; aquí se ubican en el texto.
 */

export interface TokenNer {
  entity: string;
  score: number;
  word: string;
}

const CONFIANZA_MINIMA = 0.6;
const VENTANA_BUSQUEDA = 40;

const TIPOS: Record<
  string,
  Pick<Hallazgo, "tipo" | "nivel" | "explicacion" | "sugerencia"> | undefined
> = {
  PER: {
    tipo: "persona",
    nivel: "dato",
    explicacion:
      "Parece el nombre de una persona. Si no es indispensable para los hechos, considera quitarlo; si es tu nombre o el de alguien cercano, podría identificarte.",
    sugerencia: "[persona]",
  },
  LOC: {
    tipo: "lugar",
    nivel: "contexto",
    explicacion:
      "Parece un lugar. Un sitio muy preciso, como una oficina o colonia, puede reducir quién estuvo ahí.",
    sugerencia: "[lugar]",
  },
  ORG: {
    tipo: "organizacion",
    nivel: "contexto",
    explicacion:
      "Parece una institución. Junto con otros detalles, puede ayudar a saber quién conocía los hechos.",
    sugerencia: "[institución]",
  },
};

const esPalabra = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);

/** Corta un texto largo para no rebasar lo que el modelo admite, sin perder caracteres. */
export const partirEnFragmentos = (texto: string, maximo = 1000) => {
  const fragmentos: { inicio: number; texto: string }[] = [];
  let inicio = 0;
  while (inicio < texto.length) {
    let fin = Math.min(inicio + maximo, texto.length);
    if (fin < texto.length) {
      const ventana = texto.slice(inicio, fin);
      const finOracion = Math.max(
        ventana.lastIndexOf(". "),
        ventana.lastIndexOf("? "),
        ventana.lastIndexOf("! "),
        ventana.lastIndexOf("\n"),
      );
      if (finOracion > 0) {
        fin = inicio + finOracion + 1;
        if (texto[fin] === " " && fin + 1 - inicio <= maximo) fin++;
      } else {
        const espacio = ventana.lastIndexOf(" ");
        if (espacio > 0) fin = inicio + espacio + 1;
        // No partir un emoji ni otro par sustituto a la mitad.
        else if (/[\uD800-\uDBFF]/.test(texto[fin - 1])) fin--;
      }
    }
    fragmentos.push({ inicio, texto: texto.slice(inicio, fin) });
    inicio = fin;
  }
  return fragmentos;
};

interface Ubicado extends TokenNer {
  inicio: number;
  fin: number;
  continuacion: boolean;
}

/** Devuelve null en los tokens que no se pudieron ubicar, como [UNK]. */
const ubicarTokens = (texto: string, tokens: TokenNer[]): (Ubicado | null)[] => {
  let cursor = 0;
  return tokens.map((token) => {
    if (token.word === "[UNK]") return null;
    const continuacion = token.word.startsWith("##");
    const palabra = continuacion ? token.word.slice(2) : token.word;
    if (palabra === "") return null;
    const pos = texto.indexOf(palabra, cursor);
    if (pos < 0 || pos - cursor > VENTANA_BUSQUEDA) return null;
    cursor = pos + palabra.length;
    return { ...token, inicio: pos, fin: cursor, continuacion };
  });
};

interface Grupo {
  etiqueta: string;
  inicio: number;
  fin: number;
  puntajes: number[];
}

export const entidadesDeTokens = (
  texto: string,
  tokens: TokenNer[],
  desplazamiento = 0,
): Hallazgo[] => {
  const grupos: Grupo[] = [];
  let abierto: Grupo | null = null;

  for (const token of ubicarTokens(texto, tokens)) {
    if (token === null) {
      abierto = null;
      continue;
    }
    const [prefijo, etiqueta] = token.entity.includes("-")
      ? token.entity.split("-")
      : [null, token.entity];

    if (abierto && token.continuacion) {
      // Un subtoken es parte de la misma palabra, sea cual sea su etiqueta.
      abierto.fin = token.fin;
      abierto.puntajes.push(token.score);
    } else if (etiqueta === "O") {
      abierto = null;
    } else if (abierto && prefijo === "I" && abierto.etiqueta === etiqueta) {
      abierto.fin = token.fin;
      abierto.puntajes.push(token.score);
    } else {
      abierto = { etiqueta, inicio: token.inicio, fin: token.fin, puntajes: [token.score] };
      grupos.push(abierto);
    }
  }

  const hallazgos: Hallazgo[] = [];
  for (const grupo of grupos) {
    const definicion = TIPOS[grupo.etiqueta];
    if (!definicion) continue;
    const promedio = grupo.puntajes.reduce((a, b) => a + b, 0) / grupo.puntajes.length;
    if (promedio < CONFIANZA_MINIMA) continue;
    let { inicio, fin } = grupo;
    while (esPalabra(texto[inicio - 1])) inicio--;
    while (esPalabra(texto[fin])) fin++;
    if (fin - inicio < 2) continue;
    hallazgos.push({
      ...definicion,
      inicio: inicio + desplazamiento,
      fin: fin + desplazamiento,
      texto: texto.slice(inicio, fin),
    });
  }
  return hallazgos;
};

const CARGOS =
  "director(?:a)?|subdirector(?:a)?|secretari[oa]|subsecretari[oa]|jef[ae]|coordinador(?:a)?|gerente|supervisor(?:a)?|tesorer[oa]|contador(?:a)?|auditor(?:a)?|presidente|presidenta|alcalde|alcaldesa|gobernador(?:a)?|regidor(?:a)?|s[ií]ndic[oa]|delegad[oa]|oficial\\s+mayor|titular";

const CARGO_TIPO: TipoHallazgo = "cargo";
const CARGO = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:el|la)\\s+(?:${CARGOS})(?:\\s+(?:general|adjunt[oa]|municipal|estatal|federal))?(?:\\s+de(?:l|\\s+la|\\s+los|\\s+las)?\\s+\\p{L}+)?(?![\\p{L}\\p{N}])`,
  "giu",
);

/**
 * El modelo elegido no reconoce cargos (solo personas, lugares y organizaciones):
 * esta lista los cubre y se activa junto con la capa opcional.
 */
export const detectarCargos = (texto: string): Hallazgo[] =>
  [...texto.matchAll(CARGO)].map((m) => ({
    tipo: CARGO_TIPO,
    nivel: "contexto" as const,
    inicio: m.index,
    fin: m.index + m[0].length,
    texto: m[0],
    explicacion:
      "Menciona un cargo. Si solo una persona lo ocupa, equivale a dar su nombre; piensa si hace falta para entender los hechos.",
    sugerencia: "[cargo]",
  }));
