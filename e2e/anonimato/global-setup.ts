import { compose, USAR_DESPLIEGUE_EXISTENTE } from "./apoyo";

export default function levantarDespliegue(): void {
  if (USAR_DESPLIEGUE_EXISTENTE) return;
  compose(["up", "-d", "--build", "--wait", "--wait-timeout", "300"], { salidaVisible: true });
}
