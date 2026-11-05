import type { Hallazgo, TipoHallazgo } from "./hallazgo";
import { resolverSolapes } from "./solapes";
import {
  clabeValida,
  digitosRepetidos,
  fechaCortaValida,
  pasaLuhn,
  soloDigitos,
} from "./validadores";

/** Capa 1: identificadores directos. Reglas verificables, siempre activas y sin red. */

const ANTES = "(?<![\\p{L}\\p{N}])";
const DESPUES = "(?![\\p{L}\\p{N}])";
/** Separadores de número, incluidos espacios no separables y guiones tipográficos. */
const SEP = "[ \\u00A0\\u2009\\u202F.\\-\\u2010-\\u2015]";
const SEP_GRUPO = "[ \\u00A0\\u2009\\u202F\\-\\u2010-\\u2015]";

const regla = (fuente: string, banderas = "giu") =>
  new RegExp(`${ANTES}(?:${fuente})${DESPUES}`, banderas);

const TEXTOS: Record<string, { explicacion: string; sugerencia: string }> = {
  curp: {
    explicacion: "Es una CURP: identifica a una sola persona en todo el país.",
    sugerencia: "[CURP]",
  },
  rfc: {
    explicacion: "Es un RFC: identifica a una persona o empresa ante el SAT.",
    sugerencia: "[RFC]",
  },
  telefono: {
    explicacion: "Parece un número de teléfono: se puede rastrear hasta quien lo usa.",
    sugerencia: "[teléfono]",
  },
  correo: {
    explicacion: "Es un correo electrónico: puede llevar directamente a su dueño.",
    sugerencia: "[correo]",
  },
  clabe: {
    explicacion: "Es una CLABE: identifica una cuenta bancaria y a su titular.",
    sugerencia: "[CLABE]",
  },
  tarjeta: {
    explicacion: "Parece un número de tarjeta: identifica a su titular y es un dato financiero.",
    sugerencia: "[tarjeta]",
  },
  nss: {
    explicacion: "Parece un Número de Seguridad Social: identifica a una sola persona.",
    sugerencia: "[NSS]",
  },
  placa: {
    explicacion: "Parece una placa de vehículo: se puede relacionar con su propietario.",
    sugerencia: "[placa]",
  },
};

const crear = (tipo: TipoHallazgo, inicio: number, texto: string): Hallazgo => ({
  tipo,
  nivel: "dato",
  inicio,
  fin: inicio + texto.length,
  texto,
  ...TEXTOS[tipo],
});

const ESTADOS_CURP = new Set(
  "AS BC BS CC CL CM CS CH DF DG GT GR HG JC MC MN MS NT NL OC PL QT QR SP SL SR TC TS TL VZ YN ZS NE".split(
    " ",
  ),
);
const CURP = regla("[A-Z][AEIOUX][A-Z]{2}\\d{6}[HMX][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\\d");
const curps = (texto: string) =>
  [...texto.matchAll(CURP)]
    .filter(([m]) => {
      const curp = m.toUpperCase();
      return fechaCortaValida(curp.slice(4, 10)) && ESTADOS_CURP.has(curp.slice(11, 13));
    })
    .map((m) => crear("curp", m.index, m[0]));

const RFC_GENERICOS = new Set(["XAXX010101000", "XEXX010101000"]);
const RFC = regla("[A-ZÑ&]{3,4}[ \\-]?\\d{6}[ \\-]?[A-V1-9][A-Z1-9][0-9A]");
const rfcs = (texto: string) =>
  [...texto.matchAll(RFC)]
    .filter(([m]) => {
      const limpio = m.replace(/[ -]/g, "").toUpperCase();
      // Con separadores se exige mayúscula: "casa 850214 a12" es texto corriente.
      if (limpio.length !== m.length && m !== m.toUpperCase()) return false;
      if (RFC_GENERICOS.has(limpio)) return false;
      return fechaCortaValida(limpio.slice(-9, -3));
    })
    .map((m) => crear("rfc", m.index, m[0]));

const CORREO =
  /(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}(?![\p{L}\p{N}])/gu;
const correos = (texto: string) =>
  [...texto.matchAll(CORREO)].map((m) => crear("correo", m.index, m[0]));

const CLABE = regla(
  `\\d{18}|\\d{3}${SEP_GRUPO}\\d{3}${SEP_GRUPO}\\d{11}${SEP_GRUPO}?\\d|\\d{4}(?:${SEP_GRUPO}\\d{4}){3}${SEP_GRUPO}\\d{2}`,
);
const clabes = (texto: string) =>
  [...texto.matchAll(CLABE)]
    .filter(([m]) => clabeValida(soloDigitos(m)))
    .map((m) => crear("clabe", m.index, m[0]));

const TARJETA = regla(
  `\\d{13,19}|\\d{4}(?:${SEP_GRUPO}\\d{4}){3}(?:${SEP_GRUPO}\\d{1,3})?|\\d{4}${SEP_GRUPO}\\d{6}${SEP_GRUPO}\\d{4,5}`,
);
const tarjetas = (texto: string) =>
  [...texto.matchAll(TARJETA)]
    .filter(([m]) => {
      const digitos = soloDigitos(m);
      return /^[3-6]/.test(digitos) && !digitosRepetidos(digitos) && pasaLuhn(digitos);
    })
    .map((m) => crear("tarjeta", m.index, m[0]));

/**
 * Palabras que anuncian que el número que sigue es otra cosa. Se ancla al final
 * para mirar solo lo que está pegado al número, no toda la frase.
 */
const NO_ES_DATO_PERSONAL =
  /(?:(?<!\p{L})(?:folio|expediente|exp\.?|oficio|contrato|factura|cuenta|cta\.?|clave|referencia|ref\.?|licitaci[oó]n|serie|rfc|monto|importe|cantidad|total|partida)\s*(?:n[uú]m(?:ero)?\.?|no\.?|de)?\s*[#:]?\s*|\$\s*)$/iu;
const UNIDAD_DESPUES = /^\s*(?:pesos|mxn|usd|d[oó]lares|mil|millones|mdp)(?!\p{L})/iu;

const antesDe = (texto: string, inicio: number) => texto.slice(Math.max(0, inicio - 30), inicio);

const anunciaOtraCosa = (texto: string, inicio: number, fin: number) =>
  NO_ES_DATO_PERSONAL.test(antesDe(texto, inicio)) ||
  UNIDAD_DESPUES.test(texto.slice(fin, fin + 15));

const NSS = regla(
  `\\d{11}|\\d{2}${SEP_GRUPO}\\d{2}${SEP_GRUPO}\\d{2}${SEP_GRUPO}\\d{4}${SEP_GRUPO}\\d`,
);
const nss = (texto: string) =>
  [...texto.matchAll(NSS)]
    .filter(
      (m) => pasaLuhn(soloDigitos(m[0])) && !anunciaOtraCosa(texto, m.index, m.index + m[0].length),
    )
    .map((m) => crear("nss", m.index, m[0]));

const PREFIJO_TEL = `(?:\\+?52${SEP}*(?:1${SEP}*)?|01${SEP}*|04[45]${SEP}*)?`;
const CUERPO_TEL = [
  `\\(\\d{2}\\)${SEP}*\\d{4}${SEP}?\\d{4}`,
  `\\(\\d{3}\\)${SEP}*\\d{3}${SEP}?\\d{4}`,
  `\\d{2}${SEP}\\d{4}${SEP}\\d{4}`,
  `\\d{3}${SEP}\\d{3}${SEP}\\d{4}`,
  `\\d{2}(?:${SEP}\\d{2}){4}`,
  `\\d{10}`,
].join("|");
const TELEFONO = new RegExp(`${ANTES}${PREFIJO_TEL}(?:${CUERPO_TEL})${DESPUES}`, "gu");
const TEL_LOCAL = regla(`\\d{4}${SEP_GRUPO}?\\d{4}`);
const HABLA_DE_TELEFONO =
  /(?<!\p{L})(?:tel[eé]fono|tel\.?|cel(?:ular)?\.?|whatsapp|m[oó]vil|ll[aá]ma(?:me|r)?|marca(?:r)?)\s*(?:es|al|de)?\s*:?\s*$/iu;

/**
 * Evita recortar un teléfono de una cifra con punto o guion ("3.1415926535"). El
 * espacio no cuenta: en un relato separa palabras, y omitir un teléfono real es
 * peor que avisar de más.
 */
const pegadoAOtroNumero = (texto: string, inicio: number, fin: number) =>
  /\d[.\-\u2010-\u2015]$/u.test(texto.slice(Math.max(0, inicio - 2), inicio)) ||
  /^[.\-\u2010-\u2015]\d/u.test(texto.slice(fin, fin + 2));

const telefonos = (texto: string) => {
  const largos = [...texto.matchAll(TELEFONO)]
    .filter((m) => {
      const fin = m.index + m[0].length;
      const nacional = soloDigitos(m[0]).slice(-10);
      return (
        /^[2-9]/.test(nacional) &&
        !digitosRepetidos(nacional) &&
        !pegadoAOtroNumero(texto, m.index, fin) &&
        !anunciaOtraCosa(texto, m.index, fin)
      );
    })
    .map((m) => crear("telefono", m.index, m[0]));
  const locales = [...texto.matchAll(TEL_LOCAL)]
    .filter((m) => HABLA_DE_TELEFONO.test(antesDe(texto, m.index)))
    .map((m) => crear("telefono", m.index, m[0]));
  return [...largos, ...locales];
};

/** Prefijos de oficios, normas y folios con la misma forma que una placa. */
const NO_SON_PLACA = new Set(
  "NOM NMX ISO EXP OFI FOL DOC REF ACT CON LIC SAT INE IMS CFE ART NUM".split(" "),
);
const PLACA =
  /(?<![\p{L}\p{N}-])(?:[A-Z]{3}-?\d{3}-?[A-Z]|[A-Z]{3}-\d{2}-\d{2})(?![\p{L}\p{N}]|-[\p{L}\p{N}])/gu;
const PLACA_MENCIONADA =
  /(?<!\p{L})placas?(?:\s+de\s+circulaci[oó]n)?\s*:?\s*(?:n[uú]mero\s+)?([a-z0-9]{1,4}(?:-[a-z0-9]{1,4}){0,3})(?![\p{L}\p{N}])/giu;

const placas = (texto: string) => {
  const porForma = [...texto.matchAll(PLACA)]
    .filter((m) => !NO_SON_PLACA.has(m[0].slice(0, 3)))
    .map((m) => crear("placa", m.index, m[0]));
  const porMencion = [...texto.matchAll(PLACA_MENCIONADA)]
    .filter(([, placa]) => {
      const compacta = placa.replace(/-/g, "");
      return compacta.length >= 5 && /\d/.test(compacta) && /\p{L}/u.test(compacta);
    })
    .map((m) => crear("placa", m.index + m[0].length - m[1].length, m[1]));
  return [...porForma, ...porMencion];
};

export const detectarDatos = (texto: string): Hallazgo[] =>
  resolverSolapes([
    ...correos(texto),
    ...curps(texto),
    ...rfcs(texto),
    ...clabes(texto),
    ...tarjetas(texto),
    ...nss(texto),
    ...telefonos(texto),
    ...placas(texto),
  ]);
