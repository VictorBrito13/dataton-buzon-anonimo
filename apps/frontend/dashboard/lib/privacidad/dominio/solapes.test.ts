import { describe, expect, it } from "vitest";
import type { Hallazgo, TipoHallazgo } from "./hallazgo";
import { resolverSolapes } from "./solapes";

const crear = (
  tipo: TipoHallazgo,
  inicio: number,
  fin: number,
  nivel: Hallazgo["nivel"] = "dato",
): Hallazgo => ({
  tipo,
  nivel,
  inicio,
  fin,
  texto: "x".repeat(fin - inicio),
  explicacion: "",
  sugerencia: "",
});

describe("resolverSolapes", () => {
  it("ordena por posición", () => {
    const r = resolverSolapes([crear("correo", 10, 15), crear("curp", 0, 5)]);
    expect(r.map((h) => h.tipo)).toEqual(["curp", "correo"]);
  });
  it("un dato gana a un contexto aunque el contexto sea más largo", () => {
    const r = resolverSolapes([crear("fecha_exacta", 0, 20, "contexto"), crear("rfc", 5, 10)]);
    expect(r.map((h) => h.tipo)).toEqual(["rfc"]);
  });
  it("con el mismo nivel gana la regla de mayor prioridad", () => {
    const r = resolverSolapes([crear("telefono", 0, 18), crear("clabe", 0, 18)]);
    expect(r.map((h) => h.tipo)).toEqual(["clabe"]);
  });
  it("una regla gana a una entidad del modelo", () => {
    const r = resolverSolapes([crear("persona", 0, 30), crear("correo", 3, 20)]);
    expect(r.map((h) => h.tipo)).toEqual(["correo"]);
  });
  it("conserva hallazgos contiguos", () => {
    expect(resolverSolapes([crear("curp", 0, 5), crear("rfc", 5, 9)])).toHaveLength(2);
  });
});
