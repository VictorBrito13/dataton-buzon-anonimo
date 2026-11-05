import { compose, USAR_DESPLIEGUE_EXISTENTE } from "./apoyo";

export default function bajarDespliegue(): void {
  if (USAR_DESPLIEGUE_EXISTENTE || process.env.ANONIMATO_CONSERVAR === "1") return;
  compose(["down", "-v"], { salidaVisible: true });
}
