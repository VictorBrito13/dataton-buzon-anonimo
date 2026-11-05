import { beforeEach, describe, expect, it, vi } from "vitest";
import { limpiarRastro } from "@/lib/denuncia/salida-rapida";
import {
  CLAVE_TEMA,
  PREFERENCIAS_TEMA,
  aplicarPreferencia,
  guardarPreferencia,
  leerPreferencia,
  normalizarPreferencia,
  scriptTemaInicial,
} from "./tema";

const almacenQueFalla = () => ({
  getItem: vi.fn(() => {
    throw new Error("bloqueado");
  }),
  setItem: vi.fn(() => {
    throw new Error("bloqueado");
  }),
  removeItem: vi.fn(() => {
    throw new Error("bloqueado");
  }),
});

const ejecutarScript = (guardado: string | null) => {
  const raiz = document.createElement("html");
  const local = { getItem: vi.fn(() => guardado) };
  new Function("localStorage", "document", scriptTemaInicial())(local, {
    documentElement: raiz,
  });
  return { raiz, local };
};

beforeEach(() => localStorage.clear());

describe("normalizarPreferencia", () => {
  it.each(["claro", "oscuro", "automatico"] as const)("acepta %s", (valor) => {
    expect(normalizarPreferencia(valor)).toBe(valor);
  });

  it.each([null, "", "dark", "CLARO", "<script>"])("trata %s como automático", (valor) => {
    expect(normalizarPreferencia(valor)).toBe("automatico");
  });

  it("ofrece exactamente tres preferencias", () => {
    expect(PREFERENCIAS_TEMA).toEqual(["claro", "oscuro", "automatico"]);
  });
});

describe("leerPreferencia", () => {
  it("lee lo guardado con la clave del buzón", () => {
    localStorage.setItem("buzon:tema", "oscuro");
    expect(leerPreferencia(localStorage)).toBe("oscuro");
  });

  it("no falla si el almacenamiento está bloqueado", () => {
    expect(leerPreferencia(almacenQueFalla())).toBe("automatico");
  });
});

describe("guardarPreferencia", () => {
  it("guarda claro u oscuro", () => {
    guardarPreferencia(localStorage, "claro");
    expect(localStorage.getItem(CLAVE_TEMA)).toBe("claro");
  });

  it("automático no deja rastro en el dispositivo", () => {
    guardarPreferencia(localStorage, "oscuro");
    guardarPreferencia(localStorage, "automatico");
    expect(localStorage.length).toBe(0);
  });

  it("no falla si el almacenamiento está bloqueado", () => {
    expect(() => guardarPreferencia(almacenQueFalla(), "oscuro")).not.toThrow();
    expect(() => guardarPreferencia(almacenQueFalla(), "automatico")).not.toThrow();
  });
});

describe("aplicarPreferencia", () => {
  it("marca la raíz con el tema manual", () => {
    const raiz = document.createElement("html");
    aplicarPreferencia(raiz, "oscuro");
    expect(raiz.getAttribute("data-tema")).toBe("oscuro");
  });

  it("automático retira la marca para que mande el sistema", () => {
    const raiz = document.createElement("html");
    aplicarPreferencia(raiz, "claro");
    aplicarPreferencia(raiz, "automatico");
    expect(raiz.hasAttribute("data-tema")).toBe(false);
  });
});

describe("scriptTemaInicial", () => {
  it.each(["claro", "oscuro"])("aplica %s antes de pintar", (guardado) => {
    const { raiz, local } = ejecutarScript(guardado);
    expect(local.getItem).toHaveBeenCalledWith("buzon:tema");
    expect(raiz.getAttribute("data-tema")).toBe(guardado);
  });

  it.each([null, "automatico", '"><img src=x>'])("no marca la raíz con %s", (guardado) => {
    expect(ejecutarScript(guardado).raiz.hasAttribute("data-tema")).toBe(false);
  });

  it("no lanza si el almacenamiento está bloqueado", () => {
    const raiz = document.createElement("html");
    expect(() =>
      new Function("localStorage", "document", scriptTemaInicial())(almacenQueFalla(), {
        documentElement: raiz,
      }),
    ).not.toThrow();
  });
});

describe("salida rápida", () => {
  it("borra la preferencia de tema junto con el resto del rastro", () => {
    guardarPreferencia(localStorage, "oscuro");
    limpiarRastro(localStorage, sessionStorage);
    expect(localStorage.getItem(CLAVE_TEMA)).toBeNull();
  });
});
