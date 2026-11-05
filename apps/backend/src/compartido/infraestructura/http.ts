import type { z } from "zod";
import { HttpError } from "../../errors/http-error.js";

/** Los detalles solo nombran campos: nunca devuelven ni registran los valores recibidos. */
export const validar = <T extends z.ZodType>(esquema: T, valor: unknown): z.infer<T> => {
  const resultado = esquema.safeParse(valor);
  if (resultado.success) return resultado.data;
  const campos = [...new Set(resultado.error.issues.map((i) => i.path.join(".")))];
  throw new HttpError(400, "La solicitud no es válida.", { campos });
};
