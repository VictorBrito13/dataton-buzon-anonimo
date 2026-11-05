// @vitest-environment node
import { describe, expect, it } from "vitest";
import { indexarEntes } from "@/lib/denuncia/catalogos-locales";
import { nombresDeEntes, textoEnte, textoMunicipio } from "./nombres";

const municipios = { "17": [["007", "Cuernavaca"]] } as const;
const entes = nombresDeEntes(indexarEntes([[4753, "AYUNTAMIENTO DE CUERNAVACA", "17"]]));

describe("textoMunicipio", () => {
  it("muestra el nombre del catálogo", () => {
    expect(textoMunicipio(municipios, "17007")).toBe("Cuernavaca");
  });

  it("conserva el código sin coincidencia o mientras no hay catálogo", () => {
    expect(textoMunicipio(municipios, "17999")).toBe("17999");
    expect(textoMunicipio(null, "17007")).toBe("17007");
  });

  it("dice que no se indicó si la denuncia no lo trae", () => {
    expect(textoMunicipio(municipios, null)).toBe("No indicado");
  });
});

describe("textoEnte", () => {
  it("muestra el nombre del catálogo", () => {
    expect(textoEnte(entes, "4753")).toBe("AYUNTAMIENTO DE CUERNAVACA");
  });

  it("conserva el código de un ente fuera del catálogo, como los ficticios", () => {
    expect(textoEnte(entes, "ficticio-01")).toBe("ficticio-01");
    expect(textoEnte(null, "4753")).toBe("4753");
  });

  it("dice que no se indicó si la denuncia no lo trae", () => {
    expect(textoEnte(entes, null)).toBe("No indicado");
  });
});
