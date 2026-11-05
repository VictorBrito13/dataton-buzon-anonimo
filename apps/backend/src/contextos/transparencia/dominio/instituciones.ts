/**
 * Conteos públicos de la PDN por institución. Solo conteos: ningún registro individual
 * de S1, S2, S3 o S6 entra al repositorio. Los nombres vienen sin normalizar y SESNA
 * advierte de homónimos: todo cruce por nombre es prueba de concepto, no una conclusión.
 */

/** Carpetas del paquete S3 a clave de entidad. "Mexico" se infiere como Estado de México. */
const CARPETA_A_ESTADO: Readonly<Record<string, string>> = {
  Aguascalientes: "01",
  BCS: "03",
  Chihuahua: "08",
  Durango: "10",
  Guanajuato: "11",
  Guerrero: "12",
  Jalisco: "14",
  Mexico: "15",
  Michoacán: "16",
  Morelos: "17",
  Puebla: "21",
  Quintana_Roo: "23",
  Sinaloa: "25",
  Tamaulipas: "28",
  Tlaxcala: "29",
  Veracruz: "30",
  Yucatan: "31",
  Zacatecas: "32",
};

const simplificar = (texto: string): string =>
  texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\./g, "")
    .replace(/[^A-Z0-9?\- ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const sinSufijoDeCarpeta = (nombre: string): string => {
  const [izquierda, derecha] = nombre.split(" - ");
  if (!izquierda || !derecha) return nombre;
  const compacta = izquierda.replace(/ /g, "");
  return compacta.startsWith(derecha.replace(/ /g, "")) ? izquierda : nombre;
};

/** Forma comparable de un nombre, sin acentos ni el sufijo repetido del paquete S3. */
export const normalizarNombre = (nombre: string): string =>
  sinSufijoDeCarpeta(simplificar(nombre)).replace(/[?]/g, " ").replace(/\s+/g, " ").trim();

/** Los códigos internos y los cargos no nombran una institución y no se publican. */
export const esNombreDeInstitucion = (nombre: string): boolean => {
  const limpio = simplificar(nombre);
  if (/^[A-Z]{2,5}-\d+$/.test(limpio)) return false;
  if (
    /^(POLICIA|OFICIAL|AGENTE|DIRECTOR|DIRECTORA|JEFE|JEFA|SUBDIRECTOR)\b(?! DE AREA DE)/.test(
      limpio,
    )
  ) {
    return /\b(MUNICIPAL|METROPOLITANA|ESTATAL)\b/.test(limpio);
  }
  return limpio.length > 0;
};

/** S6 interpreta `buyer_name` como regex: se escapa y se ancla para contar solo ese nombre. */
export const regexExacta = (nombre: string): string =>
  `^${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;

export interface FilaS3 {
  carpeta: string;
  ente: string;
  n: number;
}

export interface InstitucionS3 {
  estado: string;
  nombre: string;
  /** null: menos registros que el umbral. El valor exacto no se versiona. */
  conteo: number | null;
}

export interface ConsolidadoS3 {
  instituciones: InstitucionS3[];
  porEstado: { estado: string; registros: number; instituciones: number }[];
  registrosConNombreNoInterpretable: number;
}

/** Une variantes de un mismo nombre dentro de un estado y aplica el umbral por institución. */
export const consolidarConteosS3 = (
  filas: readonly FilaS3[],
  { umbral }: { umbral: number },
): ConsolidadoS3 => {
  const porClave = new Map<string, { estado: string; nombre: string; n: number }>();
  const totales = new Map<string, number>();
  const conComodin: { estado: string; patron: RegExp; nombre: string; n: number }[] = [];
  let noInterpretables = 0;

  for (const fila of filas) {
    const estado = CARPETA_A_ESTADO[fila.carpeta];
    if (!estado) throw new Error(`Carpeta de proveedor S3 sin estado conocido: ${fila.carpeta}`);
    totales.set(estado, (totales.get(estado) ?? 0) + fila.n);
    if (!esNombreDeInstitucion(fila.ente)) {
      noInterpretables += fila.n;
      continue;
    }
    const conSignos = sinSufijoDeCarpeta(simplificar(fila.ente));
    if (conSignos.includes("?")) {
      const patron = new RegExp(`^${conSignos.replace(/[?]/g, ".")}$`);
      conComodin.push({ estado, patron, nombre: normalizarNombre(fila.ente), n: fila.n });
      continue;
    }
    const nombre = normalizarNombre(fila.ente);
    const clave = `${estado}|${nombre}`;
    const previo = porClave.get(clave);
    if (previo) previo.n += fila.n;
    else porClave.set(clave, { estado, nombre, n: fila.n });
  }

  // Los "?" son acentos perdidos por codificación en el origen.
  for (const fila of conComodin) {
    const destino = [...porClave.values()].find(
      (i) => i.estado === fila.estado && fila.patron.test(i.nombre),
    );
    if (destino) destino.n += fila.n;
    else porClave.set(`${fila.estado}|${fila.nombre}`, { ...fila });
  }

  const ordenadas = [...porClave.values()].sort(
    (a, b) => a.estado.localeCompare(b.estado) || b.n - a.n || a.nombre.localeCompare(b.nombre),
  );

  return {
    instituciones: ordenadas.map(({ estado, nombre, n }) => ({
      estado,
      nombre,
      conteo: n >= umbral ? n : null,
    })),
    porEstado: [...totales.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([estado, registros]) => ({
        estado,
        registros,
        instituciones: ordenadas.filter((i) => i.estado === estado).length,
      })),
    registrosConNombreNoInterpretable: noInterpretables,
  };
};

export interface CompradorS6 {
  nombre: string;
  procedimientos: number;
  /** Claves de entidad según Cobertura ("00" es federal); vacío si no aparece allí. */
  jurisdicciones: string[];
}

/**
 * La búsqueda de S6 no distingue mayúsculas: dos variantes así devuelven el mismo total y sumarlas
 * contaría doble. Variantes con otra escritura (acentos) sí son búsquedas distintas y se suman.
 */
export const consolidarCompradores = (compradores: readonly CompradorS6[]): CompradorS6[] => {
  const grupos = new Map<string, { primero: CompradorS6; escrituras: Map<string, number> }>();
  const jurisdicciones = new Map<string, Set<string>>();
  for (const comprador of compradores) {
    const clave = normalizarNombre(comprador.nombre);
    const grupo = grupos.get(clave) ?? { primero: comprador, escrituras: new Map() };
    grupo.escrituras.set(comprador.nombre.toLowerCase(), comprador.procedimientos);
    grupos.set(clave, grupo);
    const propias = jurisdicciones.get(clave) ?? new Set<string>();
    for (const j of comprador.jurisdicciones) propias.add(j);
    jurisdicciones.set(clave, propias);
  }
  return [...grupos.entries()]
    .map(([clave, { primero, escrituras }]) => ({
      nombre: primero.nombre,
      procedimientos: [...escrituras.values()].reduce((s, n) => s + n, 0),
      jurisdicciones: [...(jurisdicciones.get(clave) ?? [])].sort(),
    }))
    .sort((a, b) => b.procedimientos - a.procedimientos || a.nombre.localeCompare(b.nombre));
};

export interface CoincidenciaPdn {
  nombre: string;
  estado: string;
  sanciones: number | null;
  procedimientos: number;
}

export interface ResultadoCruce {
  coincidencias: CoincidenciaPdn[];
  /** Mismo nombre en otra jurisdicción: la "Secretaría de Salud" de un estado no es la federal. */
  homonimosDescartados: number;
  /** Mismo nombre, pero el comprador no aparece en Cobertura y no se puede comparar. */
  sinJurisdiccionConocida: number;
}

/** Solo cuenta como cruce el mismo nombre normalizado dentro de la misma jurisdicción. */
export const cruzarPorNombreYJurisdiccion = (
  s3: readonly InstitucionS3[],
  s6: readonly CompradorS6[],
): ResultadoCruce => {
  const compradores = new Map(s6.map((c) => [normalizarNombre(c.nombre), c]));
  const resultado: ResultadoCruce = {
    coincidencias: [],
    homonimosDescartados: 0,
    sinJurisdiccionConocida: 0,
  };
  for (const institucion of s3) {
    const comprador = compradores.get(normalizarNombre(institucion.nombre));
    if (!comprador) continue;
    if (comprador.jurisdicciones.length === 0) resultado.sinJurisdiccionConocida += 1;
    else if (
      comprador.jurisdicciones.length > 1 ||
      comprador.jurisdicciones[0] !== institucion.estado
    )
      resultado.homonimosDescartados += 1;
    else
      resultado.coincidencias.push({
        nombre: institucion.nombre,
        estado: institucion.estado,
        sanciones: institucion.conteo,
        procedimientos: comprador.procedimientos,
      });
  }
  return resultado;
};
