import { describe, expect, it } from "vitest";
import type { Hallazgo } from "@/lib/privacidad";
import { claveIgnorado, quitarIgnorados, reemplazarHallazgo, segmentarTexto } from "./depuracion";

const hallazgo = (texto: string, inicio: number, sugerencia = "[dato]"): Hallazgo => ({
  tipo: "telefono",
  nivel: "dato",
  inicio,
  fin: inicio + texto.length,
  texto,
  explicacion: "Puede identificarte",
  sugerencia,
});

describe("segmentarTexto", () => {
  it("devuelve el texto completo cuando no hay hallazgos", () => {
    expect(segmentarTexto("hola", [])).toEqual([{ texto: "hola" }]);
  });

  it("intercala los hallazgos en orden aunque lleguen desordenados", () => {
    const a = hallazgo("uno", 0);
    const b = hallazgo("dos", 4);
    expect(segmentarTexto("uno dos fin", [b, a])).toEqual([
      { texto: "uno", hallazgo: a },
      { texto: " " },
      { texto: "dos", hallazgo: b },
      { texto: " fin" },
    ]);
  });

  it("no duplica texto si dos hallazgos se traslapan", () => {
    const a = hallazgo("Juan Pérez", 0);
    const b = hallazgo("Pérez", 5);
    const unido = segmentarTexto("Juan Pérez vino", [a, b])
      .map((s) => s.texto)
      .join("");
    expect(unido).toBe("Juan Pérez vino");
  });
});

describe("reemplazarHallazgo", () => {
  it("sustituye el texto por la sugerencia y recorre los hallazgos posteriores", () => {
    const texto = "Tel 5512345678 y a@b.mx";
    const tel = hallazgo("5512345678", 4, "[teléfono]");
    const correo = hallazgo("a@b.mx", 17, "[correo]");
    const r = reemplazarHallazgo(texto, [tel, correo], tel);
    expect(r.texto).toBe("Tel [teléfono] y a@b.mx");
    expect(r.hallazgos).toHaveLength(1);
    const siguiente = r.hallazgos[0] as Hallazgo;
    expect(r.texto.slice(siguiente.inicio, siguiente.fin)).toBe("a@b.mx");
  });

  it("descarta los hallazgos que se traslapaban con el reemplazado", () => {
    const a = hallazgo("Juan Pérez", 0, "[nombre]");
    const b = hallazgo("Pérez", 5);
    const r = reemplazarHallazgo("Juan Pérez vino", [a, b], a);
    expect(r.texto).toBe("[nombre] vino");
    expect(r.hallazgos).toEqual([]);
  });

  it("no toca el texto si ya no coincide con lo que se detectó", () => {
    const a = hallazgo("uno", 0);
    const r = reemplazarHallazgo("otro texto", [a], a);
    expect(r.texto).toBe("otro texto");
    expect(r.hallazgos).toEqual([]);
  });
});

describe("hallazgos ignorados", () => {
  it("la decisión de ignorar se recuerda al volver a escanear", () => {
    const a = hallazgo("uno", 0);
    const movido = hallazgo("uno", 9);
    const otro = hallazgo("dos", 20);
    expect(quitarIgnorados([movido, otro], [claveIgnorado(a)])).toEqual([otro]);
  });
});
