import { TIPOS_FALTA } from "@dataton/shared";
import { describe, expect, it } from "vitest";
import { AVISO_ORIENTADOR, QUIENES, senalesDe, sugerirTipoFalta } from "./orientador";

describe("orientador ¿Qué puedo denunciar?", () => {
  it("pregunta primero quién lo hizo: servidor público o particular", () => {
    expect(QUIENES.map((q) => q.clave)).toEqual(["servidor_publico", "particular"]);
  });

  it("ofrece a cada quien sus señales en lenguaje común, con la opción de no estar seguro", () => {
    expect(senalesDe("servidor_publico").map((s) => s.clave)).toEqual([
      "pidio",
      "uso_cargo",
      "favorecio",
      "oculto",
      "delito",
      "no_seguro",
    ]);
    expect(senalesDe("particular").map((s) => s.clave)).toEqual([
      "ofrecio",
      "empresa",
      "gestor",
      "ventaja",
      "delito",
      "no_seguro",
    ]);
  });

  it("si la persona cree que puede ser un delito, sugiere hecho de corrupción", () => {
    expect(sugerirTipoFalta("servidor_publico", "delito")?.tipoFalta).toBe("hecho_corrupcion");
    expect(sugerirTipoFalta("particular", "delito")?.tipoFalta).toBe("hecho_corrupcion");
  });

  it("sugiere el tipo de falta correspondiente", () => {
    expect(sugerirTipoFalta("servidor_publico", "pidio")?.tipoFalta).toBe("cohecho");
    expect(sugerirTipoFalta("servidor_publico", "uso_cargo")?.tipoFalta).toBe("abuso_funciones");
    expect(sugerirTipoFalta("servidor_publico", "favorecio")?.tipoFalta).toBe("conflicto_interes");
    expect(sugerirTipoFalta("servidor_publico", "oculto")?.tipoFalta).toBe("falta_no_grave");
    expect(sugerirTipoFalta("particular", "ofrecio")?.tipoFalta).toBe("falta_particulares");
    expect(sugerirTipoFalta("particular", "gestor")?.tipoFalta).toBe("falta_particulares");
  });

  it("no estar seguro siempre lleva a 'otra', sin obligar a clasificar", () => {
    expect(sugerirTipoFalta("servidor_publico", "no_seguro")?.tipoFalta).toBe("otra");
    expect(sugerirTipoFalta("particular", "no_seguro")?.tipoFalta).toBe("otra");
  });

  it("toda señal apunta a una clave real del catálogo y trae su etiqueta", () => {
    for (const { clave: quien } of QUIENES) {
      for (const { clave } of senalesDe(quien)) {
        const sugerencia = sugerirTipoFalta(quien, clave);
        expect(sugerencia).not.toBeNull();
        const tipo = sugerencia?.tipoFalta as keyof typeof TIPOS_FALTA;
        expect(sugerencia?.etiqueta).toBe(TIPOS_FALTA[tipo].etiqueta);
      }
    }
  });

  it("una señal de otro grupo no produce sugerencia", () => {
    expect(sugerirTipoFalta("particular", "pidio")).toBeNull();
  });

  it("avisa que es orientativo y no una determinación jurídica", () => {
    expect(AVISO_ORIENTADOR).toMatch(/orientativ/i);
    expect(AVISO_ORIENTADOR).toMatch(/determinación jurídica/i);
  });
});
