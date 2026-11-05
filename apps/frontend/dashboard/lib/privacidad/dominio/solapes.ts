import type { Hallazgo, TipoHallazgo } from "./hallazgo";

/** De mayor a menor certeza: primero las reglas verificables, al final el modelo. */
const PRIORIDAD: TipoHallazgo[] = [
  "correo",
  "curp",
  "rfc",
  "clabe",
  "tarjeta",
  "nss",
  "telefono",
  "placa",
  "persona",
  "fecha_exacta",
  "descripcion_unica",
  "cargo",
  "organizacion",
  "lugar",
];

const nivelPeso = (h: Hallazgo) => (h.nivel === "dato" ? 0 : 1);

/** Deja una lista ordenada y sin solapes: un fragmento solo puede tener un hallazgo. */
export const resolverSolapes = (hallazgos: Hallazgo[]): Hallazgo[] => {
  const candidatos = [...hallazgos].sort(
    (a, b) =>
      nivelPeso(a) - nivelPeso(b) ||
      PRIORIDAD.indexOf(a.tipo) - PRIORIDAD.indexOf(b.tipo) ||
      b.fin - b.inicio - (a.fin - a.inicio) ||
      a.inicio - b.inicio,
  );
  const aceptados: Hallazgo[] = [];
  for (const candidato of candidatos) {
    const choca = aceptados.some((h) => candidato.inicio < h.fin && h.inicio < candidato.fin);
    if (!choca) aceptados.push(candidato);
  }
  return aceptados.sort((a, b) => a.inicio - b.inicio);
};
