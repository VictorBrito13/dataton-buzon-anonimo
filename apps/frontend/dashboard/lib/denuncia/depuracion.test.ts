import { describe, expect, it } from "vitest";
import type { Hallazgo } from "@/lib/privacidad";
import {
  claveIgnorado,
  quitarIgnorados,
  reemplazarHallazgo,
  segmentarTexto,
  sugerenciaEnContexto,
} from "./depuracion";

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

  it("una fecha al inicio de la oración deja la oración con mayúscula", () => {
    const texto = "El 14 de marzo de 2026 pidió dinero.";
    const r = reemplazarHallazgo(
      texto,
      [hallazgo("El 14 de marzo de 2026", 0, "en marzo de 2026")],
      hallazgo("El 14 de marzo de 2026", 0, "en marzo de 2026"),
    );
    expect(r.texto).toBe("En marzo de 2026 pidió dinero.");
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

describe("sugerenciaEnContexto", () => {
  const fecha = (texto: string, original: string, sugerencia = "en marzo de 2026") =>
    sugerenciaEnContexto(texto, hallazgo(original, texto.indexOf(original), sugerencia));

  it("respeta la mayúscula si el hallazgo la traía", () => {
    expect(fecha("El 14 de marzo de 2026 vi todo", "El 14 de marzo de 2026")).toBe(
      "En marzo de 2026",
    );
  });

  it.each([
    ["al inicio del texto", "14/03/2026 fue el pago"],
    ["tras un punto", "Lo vi. 14/03/2026 fue el pago"],
    ["tras signos de cierre", "¿Lo viste? 14/03/2026 fue el pago"],
    ["en una línea nueva", "Hechos\n14/03/2026 fue el pago"],
    ["tras signos de apertura", "Dijo. ¿14/03/2026 fue el pago?"],
  ])("empieza con mayúscula %s, aunque la fecha empiece con número", (_caso, texto) => {
    expect(fecha(texto, "14/03/2026", "marzo de 2026")).toBe("Marzo de 2026");
  });

  it("deja la minúscula a media oración", () => {
    expect(fecha("Fue el 14 de marzo de 2026 cuando", "el 14 de marzo de 2026")).toBe(
      "en marzo de 2026",
    );
    expect(fecha("Pagó, el 14/03/2026 y se fue", "el 14/03/2026")).toBe("en marzo de 2026");
  });

  it("no altera las sugerencias que empiezan con un corchete", () => {
    expect(fecha("5512345678 es su número", "5512345678", "[teléfono]")).toBe("[teléfono]");
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
