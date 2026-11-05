/**
 * Reglas del presupuesto de JavaScript, sin lectura de archivos. Mide bytes en gzip, que no cambian
 * entre corridas: a diferencia de un tiempo, no depende de la máquina ni de qué tan ocupada esté.
 */
const KB = 1024;

const sinRepetidos = (archivos) => {
  const vistos = new Map();
  for (const archivo of archivos) vistos.set(archivo.nombre, archivo);
  return [...vistos.values()];
};

/**
 * @param medidas [{ ruta, archivos: [{ nombre, gzipBytes, contenido }] }]
 * @param presupuesto { rutas: { ruta: limiteKb }, prohibidoEnCargaInicial: { nombre: firma } }
 */
export const evaluarPresupuesto = (medidas, presupuesto) => {
  const fallas = [];
  const filas = [];
  const firmas = Object.entries(presupuesto.prohibidoEnCargaInicial ?? {});

  for (const [ruta, limiteKb] of Object.entries(presupuesto.rutas)) {
    const medida = medidas.find((m) => m.ruta === ruta);
    if (!medida) {
      fallas.push(`${ruta}: no aparece en la compilación`);
      continue;
    }
    const archivos = sinRepetidos(medida.archivos);
    if (archivos.length === 0) {
      fallas.push(`${ruta}: sin archivos; la barrera no estaría midiendo nada`);
      continue;
    }
    const kb = archivos.reduce((suma, a) => suma + a.gzipBytes, 0) / KB;
    filas.push({ ruta, kb, limiteKb });
    if (kb > limiteKb) {
      fallas.push(`${ruta}: ${kb.toFixed(1)} KB supera el límite de ${limiteKb} KB`);
    }
    for (const [nombre, firma] of firmas) {
      if (archivos.some((a) => a.contenido.includes(firma))) {
        fallas.push(`${nombre} entró en la carga inicial de ${ruta}: debe importarse al usarse`);
      }
    }
  }
  return { fallas, filas };
};

export const formatearInforme = (filas) =>
  filas.map((f) => `${f.ruta.padEnd(24)} ${f.kb.toFixed(1)} KB de ${f.limiteKb} KB`).join("\n");
