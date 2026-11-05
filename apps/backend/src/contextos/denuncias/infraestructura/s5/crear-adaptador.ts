import type { AdaptadorS5 } from "../../aplicacion/puerto-s5.js";
import { MockS5 } from "./mock-s5.js";
import { RealS5 } from "./real-s5.js";

export const crearAdaptadorS5 = (config: {
  adaptador: "mock" | "real";
  baseUrl: string;
  envioAutorizado: boolean;
}): AdaptadorS5 => (config.adaptador === "real" ? new RealS5(config) : new MockS5());
