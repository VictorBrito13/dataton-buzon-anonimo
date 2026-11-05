import { randomUUID } from "node:crypto";
import type {
  AdaptadorS5,
  CatalogoS5,
  EstadisticasS5,
  RegistroCatalogoS5,
} from "../../aplicacion/puerto-s5.js";

/** Datos sintéticos con la misma forma que las respuestas observadas en la versión de pruebas. */
const CATALOGOS: Record<CatalogoS5, RegistroCatalogoS5[]> = {
  entidades: [
    { id: 9, nombre: "Ciudad de México", claveAGEE: "09" },
    { id: 17, nombre: "Morelos", claveAGEE: "17" },
  ],
  municipios: [
    { id: 1, nombre: "Municipio Sintético Uno", claveAGEM: "001", claveAGEE: 17 },
    { id: 2, nombre: "Municipio Sintético Dos", claveAGEM: "002", claveAGEE: 17 },
  ],
  faltas: [
    { id: 1, entidad: 17, clasificacion: "faltaGrave", nombre: "Cohecho" },
    { id: 2, entidad: 17, clasificacion: "faltaNoGrave", nombre: "Falta sintética no grave" },
  ],
};

export class MockS5 implements AdaptadorS5 {
  catalogo(catalogo: CatalogoS5): Promise<RegistroCatalogoS5[]> {
    return Promise.resolve(CATALOGOS[catalogo]);
  }

  estadisticas(): Promise<EstadisticasS5> {
    return Promise.resolve({
      metrics: { totalDenuncias: 12, faltasAdministrativas: 7, tasaResolucion: 25 },
      monthly: [{ mes: "ene 2026", totalDenuncias: 12 }],
    });
  }

  registrarDenuncia(): Promise<{ referencia: string }> {
    return Promise.resolve({ referencia: `mock-${randomUUID()}` });
  }
}
