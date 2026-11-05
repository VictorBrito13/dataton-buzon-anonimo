import { describe, expect, it } from "vitest";
import { NO_RECUERDO, armarRelato, describirCuando } from "./relato";

describe("describirCuando", () => {
  it("escribe mes y año en lenguaje claro", () => {
    expect(describirCuando("2026-03")).toBe("marzo de 2026");
  });

  it("deja claro cuando la persona no lo recuerda", () => {
    expect(describirCuando(NO_RECUERDO)).toBe("No lo recuerda");
  });
});

describe("armarRelato", () => {
  it("deja solo el relato si no hay personas ni fecha", () => {
    expect(armarRelato({ relato: "  Pasó esto.  ", personas: [] })).toBe("Pasó esto.");
  });

  it("incluye cuándo pasó aproximadamente, dentro del texto que se sella", () => {
    expect(armarRelato({ relato: "Pasó esto.", personas: [], cuando: "2026-03" })).toBe(
      "Cuándo pasó, aproximadamente: marzo de 2026\n\nPasó esto.",
    );
  });

  it("agrega las personas o entes como lista legible para la autoridad", () => {
    const texto = armarRelato({
      relato: "Pasó esto.",
      personas: [
        { nombre: "Ana Ruiz", cargo: "Directora" },
        { nombre: "Obras Públicas", cargo: "" },
        { nombre: "", cargo: "Cajero" },
      ],
    });
    expect(texto).toBe(
      "Pasó esto.\n\nPersonas o entes involucrados:\n- Ana Ruiz (Directora)\n- Obras Públicas\n- Cajero",
    );
  });
});
