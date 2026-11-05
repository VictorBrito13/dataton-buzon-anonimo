/**
 * Único punto de registro de errores. Los mensajes de error pueden traer datos del usuario
 * (`pg` incluye valores, `body-parser` adjunta el cuerpo), así que solo se escribe el nombre,
 * el código y los marcos de pila; nunca el mensaje ni otras propiedades del error.
 */
export const registrarError = (contexto: string, error: unknown): void => {
  const { name, code, stack } = (error ?? {}) as {
    name?: unknown;
    code?: unknown;
    stack?: unknown;
  };
  const nombre = typeof name === "string" ? name : "Error";
  const codigo = typeof code === "string" || typeof code === "number" ? ` ${code}` : "";
  const marcos =
    typeof stack === "string"
      ? stack
          .split("\n")
          .filter((linea) => linea.startsWith("    at "))
          .slice(0, 8)
          .join("\n")
      : "";
  console.error(`[backend] ${contexto}: ${nombre}${codigo}\n${marcos}`);
};
