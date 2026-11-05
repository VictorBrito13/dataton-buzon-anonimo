import { beforeEach, describe, expect, it } from "vitest";
import { CLAVE_BORRADOR, borrarBorrador, guardarBorrador, leerBorrador } from "./borrador";

const datos = {
  hechos: {
    estado: "17",
    municipio: "",
    tipoFalta: "otra",
    enteId: "",
    cuando: "2026-03",
    relato: "Texto",
  },
  personas: [{ nombre: "Ente", cargo: "" }],
};

describe("borrador local", () => {
  beforeEach(() => localStorage.clear());

  it("usa una clave con el prefijo buzon:", () => {
    expect(CLAVE_BORRADOR.startsWith("buzon:")).toBe(true);
  });

  it("no hay borrador hasta que la persona decide guardarlo", () => {
    expect(leerBorrador(localStorage)).toBeNull();
  });

  it("guarda y recupera hechos y personas", () => {
    guardarBorrador(localStorage, datos);
    expect(leerBorrador(localStorage)).toEqual(datos);
  });

  it("nunca persiste la frase ni el folio aunque se los pasen por error", () => {
    guardarBorrador(localStorage, {
      ...datos,
      frase: "ancla barco cielo dedo pera mesa",
      folio: "BZ-0000-0000-0000-0000",
    } as typeof datos);
    const guardado = localStorage.getItem(CLAVE_BORRADOR) ?? "";
    expect(guardado).not.toContain("ancla");
    expect(guardado).not.toContain("BZ-");
    expect(guardado).not.toContain("frase");
  });

  it("descarta un borrador dañado en lugar de romper el formulario", () => {
    localStorage.setItem(CLAVE_BORRADOR, "{no es json");
    expect(leerBorrador(localStorage)).toBeNull();
    expect(localStorage.getItem(CLAVE_BORRADOR)).toBeNull();
    localStorage.setItem(CLAVE_BORRADOR, JSON.stringify({ hechos: 3 }));
    expect(leerBorrador(localStorage)).toBeNull();
  });

  it("borrar elimina la clave", () => {
    guardarBorrador(localStorage, datos);
    borrarBorrador(localStorage);
    expect(localStorage.getItem(CLAVE_BORRADOR)).toBeNull();
  });

  it("si el almacenamiento falla, guardar y leer no rompen el flujo", () => {
    const roto = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
      removeItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(guardarBorrador(roto, datos)).toBe(false);
    expect(leerBorrador(roto)).toBeNull();
    expect(() => borrarBorrador(roto)).not.toThrow();
  });
});
