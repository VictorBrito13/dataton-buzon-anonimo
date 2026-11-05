import JSZip from "jszip";

const resolverDestino = (rutaRels: string, destino: string): string => {
  if (destino.startsWith("/")) return destino.slice(1);
  const base = rutaRels.replace(/_rels\/[^/]*$/, "");
  const piezas: string[] = [];
  for (const pieza of `${base}${destino}`.split("/")) {
    if (pieza === "..") piezas.pop();
    else if (pieza !== "." && pieza !== "") piezas.push(pieza);
  }
  return piezas.join("/");
};

/**
 * Validación de estructura de un paquete Office (OPC), sin Office: cada `Override` y cada relación
 * interna apuntan a una parte que existe, cada parte tiene tipo de contenido y cada `r:id` usado
 * en una parte está declarado en su `.rels`. Devuelve los problemas encontrados; vacío si es coherente.
 */
export const problemasDeEstructuraOffice = async (bytes: Uint8Array): Promise<string[]> => {
  const zip = await JSZip.loadAsync(bytes);
  const partes = Object.values(zip.files)
    .filter((f) => !f.dir)
    .map((f) => f.name);
  const texto = (nombre: string) => zip.file(nombre)?.async("string");
  const problemas: string[] = [];

  const tipos = (await texto("[Content_Types].xml")) ?? "";
  const porExtension = new Set(
    [...tipos.matchAll(/<Default\b[^>]*\bExtension="([^"]+)"/g)].map((m) => m[1]?.toLowerCase()),
  );
  const overrides = [...tipos.matchAll(/<Override\b[^>]*\bPartName="\/([^"]+)"/g)].map(
    (m) => m[1] as string,
  );
  for (const parte of overrides) {
    if (!partes.includes(parte)) problemas.push(`Override sin parte: ${parte}`);
  }
  for (const parte of partes) {
    if (parte === "[Content_Types].xml") continue;
    const extension = parte.split(".").pop()?.toLowerCase() ?? "";
    if (!overrides.includes(parte) && !porExtension.has(extension)) {
      problemas.push(`Parte sin tipo de contenido: ${parte}`);
    }
  }

  for (const rels of partes.filter((p) => p.endsWith(".rels"))) {
    const xml = (await texto(rels)) ?? "";
    const ids = new Set<string>();
    for (const [relacion] of xml.matchAll(/<Relationship\b[^>]*\/>/g)) {
      const id = /\bId="([^"]*)"/.exec(relacion)?.[1] ?? "";
      const destino = /\bTarget="([^"]*)"/.exec(relacion)?.[1];
      ids.add(id);
      if (/\bTargetMode="External"/i.test(relacion) || destino === undefined) continue;
      if (!partes.includes(resolverDestino(rels, destino))) {
        problemas.push(`Relación ${id} en ${rels} apunta a una parte inexistente: ${destino}`);
      }
    }
    if (rels === "_rels/.rels") continue;
    const dueno = rels.replace(/_rels\/([^/]*)\.rels$/, "$1");
    const xmlDueno = await texto(dueno);
    if (xmlDueno === undefined) {
      problemas.push(`${rels} no tiene parte dueña (${dueno})`);
      continue;
    }
    for (const m of xmlDueno.matchAll(/\br:(?:id|embed|link|pict|href)="([^"]+)"/g)) {
      const id = m[1] as string;
      if (!ids.has(id)) problemas.push(`${dueno} usa ${id}, que no está en ${rels}`);
    }
  }
  return problemas;
};
