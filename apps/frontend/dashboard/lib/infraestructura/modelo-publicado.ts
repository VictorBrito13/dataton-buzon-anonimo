import { existsSync } from "node:fs";
import { join } from "node:path";
import { modeloPublicado } from "@/lib/denuncia/busqueda-modelo";

/**
 * Se responde en el servidor al pintar la página: así la opción dice la verdad sin
 * que el navegador haga ninguna petición antes de que la persona lo pida.
 * Tanto `next start` como el servidor standalone corren con el dashboard como cwd.
 */
export const modeloNerPublicado = (): boolean =>
  modeloPublicado((ruta) => existsSync(join(process.cwd(), "public", "modelos", ruta)));
