import { describe, expect, it } from "vitest";
import {
  esPublicable,
  finDePeriodo,
  inicioDePeriodo,
  periodoDeDia,
  periodosPublicables,
} from "./periodo.js";

describe("periodos por trimestre cerrado", () => {
  it("calcula inicio y fin del trimestre", () => {
    expect(inicioDePeriodo("2026-T3")).toBe("2026-07-01");
    expect(finDePeriodo("2026-T3")).toBe("2026-09-30");
    expect(finDePeriodo("2024-T1")).toBe("2024-03-31");
    expect(finDePeriodo("2026-T4")).toBe("2026-12-31");
  });

  it("ubica un día en su trimestre", () => {
    expect(periodoDeDia("2026-01-01")).toBe("2026-T1");
    expect(periodoDeDia("2026-09-30")).toBe("2026-T3");
    expect(periodoDeDia("2026-10-01")).toBe("2026-T4");
  });

  it("rechaza periodos que no son un trimestre, como un acumulado anual o móvil", () => {
    expect(() => finDePeriodo("2026")).toThrow();
    expect(() => finDePeriodo("2026-T5")).toThrow();
    expect(() => finDePeriodo("2026-S1")).toThrow();
  });

  it("no publica un trimestre abierto", () => {
    expect(esPublicable("2026-T4", "2026-11-04", 14)).toBe(false);
  });

  it("no publica un trimestre cerrado dentro del rezago", () => {
    expect(esPublicable("2026-T3", "2026-10-14", 14)).toBe(false);
  });

  it("publica al cumplirse el rezago", () => {
    expect(esPublicable("2026-T3", "2026-10-15", 14)).toBe(true);
  });

  it("lista solo trimestres publicables, del más antiguo al más reciente", () => {
    expect(periodosPublicables("2025-T4", "2026-11-04", 14)).toEqual([
      "2025-T4",
      "2026-T1",
      "2026-T2",
      "2026-T3",
    ]);
  });
});
