/** Navegación de teclado del patrón de pestañas (WAI-ARIA Authoring Practices). */
export const pestanaPorTecla = <T extends string>(
  lista: readonly T[],
  actual: T,
  tecla: string,
): T | null => {
  const i = lista.indexOf(actual);
  const total = lista.length;
  if (tecla === "ArrowRight") return lista[(i + 1) % total] ?? null;
  if (tecla === "ArrowLeft") return lista[(i - 1 + total) % total] ?? null;
  if (tecla === "Home") return lista[0] ?? null;
  if (tecla === "End") return lista[total - 1] ?? null;
  return null;
};
