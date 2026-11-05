import { CLAVES_ETAPA, TRANSICIONES, type Etapa } from "@dataton/shared";
import { describe, expect, it } from "vitest";
import { ErrorDominio } from "../../../src/compartido/dominio/errores.js";
import { accionBitacora } from "../../../src/contextos/tramite/dominio/bitacora.js";
import { exigirTransicion } from "../../../src/contextos/tramite/dominio/etapa.js";
import { sesionVigente } from "../../../src/contextos/tramite/dominio/sesion.js";

describe("exigirTransicion", () => {
  const pares = CLAVES_ETAPA.flatMap((desde) =>
    CLAVES_ETAPA.map((hacia) => [desde, hacia] as [Etapa, Etapa]),
  );

  it.each(pares)("%s -> %s respeta TRANSICIONES", (desde, hacia) => {
    const accion = () => exigirTransicion(desde, hacia);
    if (TRANSICIONES[desde].includes(hacia)) {
      expect(accion).not.toThrow();
    } else {
      expect(accion).toThrow(ErrorDominio);
    }
  });

  it("una denuncia resuelta no vuelve a recibida", () => {
    expect(() => exigirTransicion("resuelta", "recibida")).toThrow(/etapa/i);
  });
});

describe("sesionVigente", () => {
  it("es vigente hasta antes de expirar", () => {
    expect(sesionVigente({ usuarioId: "u", usuario: "x", expiraMs: 100 }, 99)).toBe(true);
    expect(sesionVigente({ usuarioId: "u", usuario: "x", expiraMs: 100 }, 100)).toBe(false);
  });
});

describe("accionBitacora", () => {
  it("nombra la acción con su detalle de catálogo", () => {
    expect(accionBitacora.etapaCambiada("archivada")).toBe("etapa_cambiada:archivada");
    expect(accionBitacora.etapaRechazada("archivada")).toBe("etapa_rechazada:archivada");
    expect(accionBitacora.sesionIniciada).toBe("sesion_iniciada");
  });
});
