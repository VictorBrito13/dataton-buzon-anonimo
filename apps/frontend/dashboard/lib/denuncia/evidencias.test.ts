import { describe, expect, it } from "vitest";
import { describirTamano, describirTipos, validarArchivo } from "./evidencias";

const limites = { maxBytesEvidencia: 1000, maxEvidencias: 2, tiposEvidencia: ["image/png"] };

describe("validarArchivo", () => {
  it("acepta un archivo permitido", () => {
    expect(validarArchivo({ size: 10, type: "image/png" }, limites, 0)).toBeNull();
  });

  it("rechaza vacío, tipo no permitido, exceso de tamaño y exceso de cantidad", () => {
    expect(validarArchivo({ size: 0, type: "image/png" }, limites, 0)).toMatch(/vacío/);
    expect(validarArchivo({ size: 10, type: "text/x-sh" }, limites, 0)).toMatch(/tipo/);
    expect(validarArchivo({ size: 2000, type: "image/png" }, limites, 0)).toMatch(/pesa/);
    expect(validarArchivo({ size: 10, type: "image/png" }, limites, 2)).toMatch(/2 archivos/);
  });
});

describe("describirTipos", () => {
  it("traduce los tipos que envía el servidor a nombres que la gente reconoce", () => {
    expect(describirTipos(["image/jpeg", "image/png", "application/pdf"])).toBe("JPG, PNG y PDF");
    expect(describirTipos(["image/png"])).toBe("PNG");
  });

  it("nunca muestra un tipo crudo desconocido como cadena técnica", () => {
    expect(describirTipos(["audio/ogg"])).toBe("OGG");
  });
});

describe("describirTamano", () => {
  it("usa unidades legibles", () => {
    expect(describirTamano(500)).toBe("500 B");
    expect(describirTamano(2048)).toBe("2 KB");
    expect(describirTamano(5 * 1024 * 1024)).toBe("5 MB");
  });
});
