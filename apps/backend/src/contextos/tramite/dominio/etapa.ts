import { TRANSICIONES, type Etapa } from "@dataton/shared";
import { ErrorDominio } from "../../../compartido/dominio/errores.js";

export const exigirTransicion = (actual: Etapa, nueva: Etapa): void => {
  if (!TRANSICIONES[actual].includes(nueva)) {
    throw new ErrorDominio("transicion_invalida", "La denuncia no puede pasar a esa etapa.");
  }
};
