const METADATOS = /^(docProps|customXml)\//i;
const REFERENCIA_A_METADATOS = /(docProps|customXml)\//i;

const PROHIBIDAS = [
  /vbaProject\.bin$/i,
  /vbaData\.xml$/i,
  /\/activeX\//i,
  /oleObject\d*\.bin$/i,
  /\.(exe|dll|bat|cmd|com|scr|ps1|js|vbs|jar|msi|sh)$/i,
];

export const esParteDeMetadatosOffice = (parte: string): boolean => METADATOS.test(parte);

/** Macros y objetos activos: un archivo que los lleve no se acepta, aunque su tipo lo sea. */
export const esParteProhibidaOffice = (parte: string): boolean =>
  PROHIBIDAS.some((patron) => patron.test(parte));

/** Evita que Office declare el archivo como dañado al faltarle partes referenciadas. */
export const quitarReferenciasMetadatos = (xml: string): string =>
  xml.replace(/<(Relationship|Override)\b[^>]*\/>/g, (elemento) =>
    REFERENCIA_A_METADATOS.test(elemento) ? "" : elemento,
  );

const ANONIMO = "Anónimo";

const REEMPLAZOS: readonly { parte: RegExp; aplicar: (xml: string) => string }[] = [
  {
    parte: /^word\/.*\.xml$/i,
    aplicar: (xml) =>
      xml
        .replace(/\b(w\d*:author)="[^"]*"/g, `$1="${ANONIMO}"`)
        .replace(/\b(w\d*:initials)="[^"]*"/g, '$1=""')
        .replace(/\b(w\d*:date|w\d*:dateUtc)="[^"]*"/g, '$1="2000-01-01T00:00:00Z"')
        .replace(/\b(w\d*:(?:userId|providerId))="[^"]*"/g, '$1=""'),
  },
  {
    parte: /^xl\/(comments|threadedComments|persons)/i,
    aplicar: (xml) =>
      xml
        .replace(/<author>[^<]*<\/author>/g, `<author>${ANONIMO}</author>`)
        .replace(/\b(displayName)="[^"]*"/g, `$1="${ANONIMO}"`)
        .replace(/\b(userId|providerId)="[^"]*"/g, '$1=""'),
  },
  {
    parte: /^ppt\/(commentAuthors|authors)\.xml$/i,
    aplicar: (xml) =>
      xml
        .replace(/\b(name)="[^"]*"/g, `$1="${ANONIMO}"`)
        .replace(/\b(initials|userId|providerId)="[^"]*"/g, '$1=""'),
  },
];

export const anonimizarAutoresOffice = (
  parte: string,
  xml: string,
): { xml: string; cambio: boolean } => {
  const regla = REEMPLAZOS.find((r) => r.parte.test(parte));
  if (!regla) return { xml, cambio: false };
  const salida = regla.aplicar(xml);
  return { xml: salida, cambio: salida !== xml };
};
