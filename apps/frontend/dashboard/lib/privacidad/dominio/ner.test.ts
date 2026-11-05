import { describe, expect, it } from "vitest";
import { detectarCargos, entidadesDeTokens, partirEnFragmentos, type TokenNer } from "./ner";

const t = (word: string, entity = "O", score = 0.99): TokenNer => ({ word, entity, score });

describe("entidadesDeTokens", () => {
  it("une tokens de una persona y da posiciones exactas", () => {
    const texto = "Ayer vi a Juan Pérez en la oficina";
    const tokens = [
      t("Ayer"),
      t("vi"),
      t("a"),
      t("Juan", "B-PER"),
      t("Pérez", "I-PER"),
      t("en"),
      t("la"),
      t("oficina"),
    ];
    const [h] = entidadesDeTokens(texto, tokens);
    expect(h).toMatchObject({
      tipo: "persona",
      nivel: "dato",
      texto: "Juan Pérez",
      sugerencia: "[persona]",
    });
    expect(texto.slice(h.inicio, h.fin)).toBe("Juan Pérez");
  });

  it("une subtokens y completa la palabra aunque el modelo la etiquete a medias", () => {
    const texto = "Habló Gutiérrez ayer";
    const tokens = [t("Habló"), t("Gut", "B-PER"), t("##ié"), t("##rrez", "I-PER"), t("ayer")];
    expect(entidadesDeTokens(texto, tokens).map((h) => h.texto)).toEqual(["Gutiérrez"]);
  });

  it("clasifica lugares y organizaciones como contexto", () => {
    const texto = "En Puebla, el IMSS pagó";
    const tokens = [t("En"), t("Puebla", "B-LOC"), t(","), t("el"), t("IMSS", "B-ORG"), t("pagó")];
    expect(entidadesDeTokens(texto, tokens).map((h) => [h.tipo, h.nivel, h.texto])).toEqual([
      ["lugar", "contexto", "Puebla"],
      ["organizacion", "contexto", "IMSS"],
    ]);
  });

  it("separa dos personas seguidas cuando el modelo marca un nuevo inicio", () => {
    const texto = "Ana Luis";
    const tokens = [t("Ana", "B-PER"), t("Luis", "B-PER")];
    expect(entidadesDeTokens(texto, tokens).map((h) => h.texto)).toEqual(["Ana", "Luis"]);
  });

  it("ignora fechas del modelo: las cubre la capa de contexto", () => {
    expect(entidadesDeTokens("marzo", [t("marzo", "B-DATE")])).toEqual([]);
  });

  it("descarta predicciones de baja confianza", () => {
    expect(entidadesDeTokens("Juan", [t("Juan", "B-PER", 0.3)])).toEqual([]);
  });

  it("se recupera de tokens desconocidos sin correr las posiciones", () => {
    const texto = "Vi 🦊 a Juan";
    const tokens = [t("Vi"), t("[UNK]"), t("a"), t("Juan", "B-PER")];
    const [h] = entidadesDeTokens(texto, tokens);
    expect(texto.slice(h.inicio, h.fin)).toBe("Juan");
  });

  it("aplica el desplazamiento del fragmento", () => {
    const [h] = entidadesDeTokens("Juan", [t("Juan", "B-PER")], 100);
    expect([h.inicio, h.fin]).toEqual([100, 104]);
  });

  it("descarta la entidad si no logra ubicarla en el texto", () => {
    expect(entidadesDeTokens("nada que ver", [t("Juan", "B-PER")])).toEqual([]);
  });
});

describe("partirEnFragmentos", () => {
  it("un texto corto es un solo fragmento", () => {
    expect(partirEnFragmentos("Hola.")).toEqual([{ inicio: 0, texto: "Hola." }]);
  });
  it("corta en fin de oración, sin perder texto ni pasarse del máximo", () => {
    const texto = "Una oración de prueba. ".repeat(100);
    const fragmentos = partirEnFragmentos(texto, 100);
    expect(fragmentos.length).toBeGreaterThan(1);
    for (const f of fragmentos) {
      expect(f.texto.length).toBeLessThanOrEqual(100);
      expect(texto.slice(f.inicio, f.inicio + f.texto.length)).toBe(f.texto);
    }
    expect(fragmentos.map((f) => f.texto).join("")).toBe(texto);
  });
  it("corta aunque no haya puntuación", () => {
    const fragmentos = partirEnFragmentos("x".repeat(250), 100);
    expect(fragmentos.map((f) => f.texto.length)).toEqual([100, 100, 50]);
  });
});

describe("detectarCargos", () => {
  it.each(["el director general", "la secretaria", "el tesorero municipal", "la jefa de compras"])(
    "detecta %s",
    (frase) => {
      const [h] = detectarCargos(`Lo autorizó ${frase} sin revisar.`);
      expect(h).toMatchObject({
        tipo: "cargo",
        nivel: "contexto",
        texto: frase,
        sugerencia: "[cargo]",
      });
    },
  );
  it("no marca palabras que solo contienen un cargo", () => {
    expect(detectarCargos("la secretaría de salud y el directorio")).toEqual([]);
  });
});
