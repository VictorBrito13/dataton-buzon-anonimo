import { esquemaFolio } from "@dataton/shared";
import { describe, expect, it } from "vitest";
import { ErrorDominio } from "../../../src/compartido/dominio/errores.js";
import { folioDesdeBytes, BYTES_FOLIO } from "../../../src/contextos/denuncias/dominio/folio.js";
import { nuevaDenuncia } from "../../../src/contextos/denuncias/dominio/denuncia.js";

const MEXICO = "America/Mexico_City";

const selloValido = (): Uint8Array => {
  const bytes = new Uint8Array(100);
  bytes[0] = 1;
  return bytes;
};

const datos = {
  estado: "17" as const,
  municipio: "17001",
  tipoFalta: "cohecho" as const,
  relatoSellado: selloValido(),
  evidenciaIds: [] as string[],
};

const codigoDe = (accion: () => unknown): string | undefined => {
  try {
    accion();
    return undefined;
  } catch (error) {
    return error instanceof ErrorDominio ? error.codigo : "otro";
  }
};

describe("folio", () => {
  it("usa 80 bits", () => {
    expect(BYTES_FOLIO).toBe(10);
  });

  it("produce el formato del contrato en los extremos del alfabeto", () => {
    expect(esquemaFolio.safeParse(folioDesdeBytes(new Uint8Array(10))).success).toBe(true);
    expect(esquemaFolio.safeParse(folioDesdeBytes(new Uint8Array(10).fill(255))).success).toBe(
      true,
    );
  });

  it("codifica los 80 bits en Crockford Base32", () => {
    expect(folioDesdeBytes(new Uint8Array(10))).toBe("BZ-0000-0000-0000-0000");
    expect(folioDesdeBytes(new Uint8Array(10).fill(255))).toBe("BZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ");
  });

  it("rechaza una cantidad de bytes distinta de 10", () => {
    expect(() => folioDesdeBytes(new Uint8Array(9))).toThrow();
  });
});

describe("nuevaDenuncia", () => {
  it("nace en la etapa recibida y con el día redondeado", () => {
    const denuncia = nuevaDenuncia(datos, new Date("2026-05-02T18:44:12Z"), MEXICO);
    expect(denuncia.etapa).toBe("recibida");
    expect(denuncia.recibidaDia).toBe("2026-05-02");
  });

  it("guarda el día de la zona indicada, no el de UTC", () => {
    const denuncia = nuevaDenuncia(datos, new Date("2026-11-05T03:30:00Z"), MEXICO);
    expect(denuncia.recibidaDia).toBe("2026-11-04");
  });

  it("rechaza un municipio de otro estado", () => {
    expect(
      codigoDe(() => nuevaDenuncia({ ...datos, municipio: "09001" }, new Date(), MEXICO)),
    ).toBe("municipio_fuera_de_estado");
  });

  it("permite omitir el municipio", () => {
    const { municipio: _omitido, ...sinMunicipio } = datos;
    expect(nuevaDenuncia(sinMunicipio, new Date(), MEXICO).municipio).toBeNull();
  });

  it("rechaza un relato que no está sellado", () => {
    const relatoSellado = new TextEncoder().encode("Un relato en texto claro ".repeat(10));
    expect(codigoDe(() => nuevaDenuncia({ ...datos, relatoSellado }, new Date(), MEXICO))).toBe(
      "relato_sin_sellar",
    );
  });

  it("elimina evidencias repetidas", () => {
    const id = "6a0d3f0e-3c1c-4b7c-8a55-0a5a9a8a7a11";
    expect(
      nuevaDenuncia({ ...datos, evidenciaIds: [id, id] }, new Date(), MEXICO).evidenciaIds,
    ).toEqual([id]);
  });
});
