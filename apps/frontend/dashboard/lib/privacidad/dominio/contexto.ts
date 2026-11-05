import type { Hallazgo, TipoHallazgo } from "./hallazgo";
import { resolverSolapes } from "./solapes";
import { fechaValida } from "./validadores";

/**
 * Capa 3: detalles que no son identificadores por sí solos, pero que pueden
 * reducir tanto las posibilidades que lleven hasta quien denuncia.
 */

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const MES = `${MESES.join("|")}|setiembre`;
const DIA_SEMANA = "lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo";

const numeroDeMes = (nombre: string) => {
  const mes = nombre.toLowerCase();
  return mes === "setiembre" ? 9 : MESES.indexOf(mes) + 1;
};

const palabra = (fuente: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${fuente})(?![\\p{L}\\p{N}])`, "giu");

const EXPLICA_FECHA =
  "Una fecha exacta puede reducir mucho quién estuvo presente ese día. Si no es indispensable, usa una referencia más general.";

const crear = (
  tipo: TipoHallazgo,
  inicio: number,
  texto: string,
  explicacion: string,
  sugerencia: string,
): Hallazgo => ({
  tipo,
  nivel: "contexto",
  inicio,
  fin: inicio + texto.length,
  texto,
  explicacion,
  sugerencia,
});

const hallazgoFecha = (
  inicio: number,
  texto: string,
  anio: number | null,
  mes: number,
  dia: number,
): Hallazgo | null => {
  // Sin año se valida contra uno bisiesto: el 29 de febrero sigue siendo una fecha.
  if (!fechaValida(anio ?? 2024, mes, dia)) return null;
  const general = anio === null ? MESES[mes - 1] : `${MESES[mes - 1]} de ${anio}`;
  const conArticulo = /^(?:el|del)\s/i.test(texto);
  return crear(
    "fecha_exacta",
    inicio,
    texto,
    EXPLICA_FECHA,
    conArticulo ? `en ${general}` : general,
  );
};

const ARTICULO = "(?:(?:el|del)\\s+)?";
const FECHA_LARGA = palabra(
  `${ARTICULO}(?:(?:${DIA_SEMANA})\\s+)?(\\d{1,2})\\s+de\\s+(${MES})(?:\\s+del?\\s+(\\d{4}))?`,
);
const FECHA_MES_PRIMERO = palabra(`${ARTICULO}(${MES})\\s+(\\d{1,2}),?\\s+(\\d{4})`);
const FECHA_NUMERICA = new RegExp(
  `(?<![\\p{L}\\p{N}])(?<!\\p{N}[-./])${ARTICULO}(\\d{1,2})([-./])(\\d{1,2})\\2(\\d{4}|\\d{2})(?![-./]?\\p{N})(?!\\p{L})`,
  "giu",
);
const FECHA_ISO = new RegExp(
  `(?<![\\p{L}\\p{N}])(?<!\\p{N}[-./])${ARTICULO}(\\d{4})-(\\d{2})-(\\d{2})(?![-./]?\\p{N})(?!\\p{L})`,
  "giu",
);

const fechas = (texto: string): Hallazgo[] => {
  const encontradas: (Hallazgo | null)[] = [];
  for (const m of texto.matchAll(FECHA_LARGA)) {
    const anio = m[3] ? Number(m[3]) : null;
    encontradas.push(hallazgoFecha(m.index, m[0], anio, numeroDeMes(m[2]), Number(m[1])));
  }
  for (const m of texto.matchAll(FECHA_MES_PRIMERO)) {
    encontradas.push(hallazgoFecha(m.index, m[0], Number(m[3]), numeroDeMes(m[1]), Number(m[2])));
  }
  for (const m of texto.matchAll(FECHA_NUMERICA)) {
    const anio = m[4].length === 2 ? 2000 + Number(m[4]) : Number(m[4]);
    let dia = Number(m[1]);
    let mes = Number(m[3]);
    // Formato estadounidense: solo si el mes no puede ser el segundo número.
    if (mes > 12 && dia <= 12) [dia, mes] = [mes, dia];
    encontradas.push(hallazgoFecha(m.index, m[0], anio, mes, dia));
  }
  for (const m of texto.matchAll(FECHA_ISO)) {
    encontradas.push(hallazgoFecha(m.index, m[0], Number(m[1]), Number(m[2]), Number(m[3])));
  }
  return encontradas.filter((h): h is Hallazgo => h !== null);
};

interface Patron {
  tipo: TipoHallazgo;
  regex: RegExp;
  explicacion: string;
}

const EXPLICA_UNICO =
  "Decir que solo una persona hacía o sabía algo puede señalarte a ti, aunque no des tu nombre.";
const EXPLICA_PERSONAL =
  "Hablar de lo que hiciste en primera persona puede revelar que estuviste ahí o quién eres.";
const EXPLICA_JEFE =
  "Mencionar a tu superior directo reduce quién puedes ser: solo a su equipo le aplica esa descripción.";
const EXPLICA_ROL =
  "Mencionar tu puesto, cargo o área reduce mucho quién puedes ser, sobre todo en una oficina pequeña.";

const ROLES =
  "contador(?:a)?|secretari[oa]|auxiliar|abogad[oa]|ingenier[oa]|licenciad[oa]|jef[ae]|director(?:a)?|gerente|coordinador(?:a)?|supervisor(?:a)?|analista|asesor(?:a)?|administrador(?:a)?|funcionari[oa]|servidor(?:a)?|emplead[oa]|trabajador(?:a)?|chofer|enfermer[oa]|m[eé]dic[oa]|doctor(?:a)?|maestr[oa]|profesor(?:a)?|polic[ií]a|vigilante|tesorer[oa]|auditor(?:a)?|capturista|recepcionista";
/** Sustantivos tras "soy un/una" que no dicen nada del puesto. */
const NO_ROL = "persona|testigo|ciudadan[oa]|v[ií]ctima|denunciante|mujer|hombre|[uú]nic[oa]";

const PATRONES: Patron[] = [
  {
    tipo: "descripcion_unica",
    regex: palabra("soy\\s+(?:el|la)\\s+[uú]nic[oa](?:\\s+que)?"),
    explicacion: EXPLICA_UNICO,
  },
  {
    tipo: "descripcion_unica",
    regex: palabra("(?:el|la|los|las)\\s+[uú]nic[oa]s?\\s+que"),
    explicacion: EXPLICA_UNICO,
  },
  {
    tipo: "descripcion_unica",
    regex: palabra("(?:s[oó]lo|solamente|[uú]nicamente)\\s+yo"),
    explicacion: EXPLICA_UNICO,
  },
  { tipo: "descripcion_unica", regex: palabra("nadie\\s+m[aá]s"), explicacion: EXPLICA_UNICO },
  {
    tipo: "descripcion_unica",
    regex: palabra(
      "mi\\s+(?:jefe\\s+directo|jefa\\s+directa|superior(?:\\s+inmediat[oa])?|supervisor(?:a)?|coordinador(?:a)?|director(?:a)?|gerente)",
    ),
    explicacion: EXPLICA_JEFE,
  },
  {
    tipo: "descripcion_unica",
    regex: palabra(
      "yo\\s+personalmente|yo\\s+mism[oa]|fui\\s+yo\\s+quien|fui\\s+quien|fui\\s+(?:el|la)\\s+que",
    ),
    explicacion: EXPLICA_PERSONAL,
  },
  {
    tipo: "cargo",
    regex: palabra(
      `(?:(?<!(?:el|un|mi|este|del|su)\\s)trabajo|me\\s+desempe[nñ]o)\\s+como\\s+\\p{L}+|soy\\s+(?:el|la|un|una)\\s+(?!(?:${NO_ROL})(?![\\p{L}]))\\p{L}+|soy\\s+(?:${ROLES})`,
    ),
    explicacion: EXPLICA_ROL,
  },
  {
    tipo: "cargo",
    regex: palabra(
      "mi\\s+puesto\\s+(?:es|de)|mi\\s+cargo\\s+(?:es|de)|estoy\\s+a\\s+cargo\\s+de|tengo\\s+a\\s+mi\\s+cargo|soy\\s+responsable\\s+de|soy\\s+encargad[oa]\\s+de|me\\s+encargo\\s+de|laboro\\s+en|(?<!(?:el|un|mi|este|del|su)\\s)trabajo\\s+en|en\\s+mi\\s+[aá]rea",
    ),
    explicacion: EXPLICA_ROL,
  },
];

const SUGERENCIA_DETALLE = "[detalle omitido]";

export const detectarContexto = (texto: string): Hallazgo[] => {
  const frases = PATRONES.flatMap(({ tipo, regex, explicacion }) =>
    [...texto.matchAll(regex)].map((m) =>
      crear(tipo, m.index, m[0], explicacion, SUGERENCIA_DETALLE),
    ),
  );
  return resolverSolapes([...fechas(texto), ...frases]);
};
