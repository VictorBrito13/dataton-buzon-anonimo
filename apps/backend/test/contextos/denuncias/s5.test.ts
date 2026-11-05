import { describe, expect, it } from "vitest";
import type { AdaptadorS5 } from "../../../src/contextos/denuncias/aplicacion/puerto-s5.js";
import { crearAdaptadorS5 } from "../../../src/contextos/denuncias/infraestructura/s5/crear-adaptador.js";
import { MockS5 } from "../../../src/contextos/denuncias/infraestructura/s5/mock-s5.js";
import { RealS5 } from "../../../src/contextos/denuncias/infraestructura/s5/real-s5.js";

const BASE = "https://s5.ejemplo.test";

const fetchFalso = (respuesta: unknown, estado = 200) => {
  const llamadas: { url: string; metodo: string }[] = [];
  const fetchImpl: typeof fetch = (url, init) => {
    llamadas.push({ url: url as string, metodo: init?.method ?? "GET" });
    return Promise.resolve(new Response(JSON.stringify(respuesta), { status: estado }));
  };
  return { llamadas, fetchImpl };
};

const envio = {
  estado: "17",
  municipio: null,
  tipoFalta: "cohecho",
  enteId: null,
  dia: "2026-01-01",
};

describe("MockS5", () => {
  it("entrega catálogos y estadísticas sintéticos", async () => {
    const s5 = new MockS5();
    expect((await s5.catalogo("entidades"))[0]).toHaveProperty("nombre");
    expect((await s5.catalogo("municipios"))[0]).toHaveProperty("claveAGEM");
    expect((await s5.catalogo("faltas"))[0]).toHaveProperty("clasificacion");
    expect((await s5.estadisticas()).metrics.totalDenuncias).toBeGreaterThanOrEqual(0);
  });

  it("simula el envío sin red", async () => {
    const s5: AdaptadorS5 = new MockS5();
    expect((await s5.registrarDenuncia(envio)).referencia).toMatch(/^mock-/);
  });
});

describe("RealS5", () => {
  it("lee catálogos de la ruta pública comprobada", async () => {
    const { llamadas, fetchImpl } = fetchFalso({
      data: [{ id: 1, nombre: "Aguascalientes", claveAGEE: "01" }],
    });
    const s5 = new RealS5({ baseUrl: `${BASE}/`, envioAutorizado: false, fetchImpl });
    expect(await s5.catalogo("entidades")).toEqual([
      { id: 1, nombre: "Aguascalientes", claveAGEE: "01" },
    ]);
    expect(llamadas).toEqual([
      { url: `${BASE}/next-api/public/catalogos?catalog=entidades`, metodo: "GET" },
    ]);
  });

  it("lee estadísticas de la ruta pública comprobada", async () => {
    const { llamadas, fetchImpl } = fetchFalso({ metrics: { totalDenuncias: 8 }, monthly: [] });
    const s5 = new RealS5({ baseUrl: BASE, envioAutorizado: false, fetchImpl });
    expect((await s5.estadisticas()).metrics.totalDenuncias).toBe(8);
    expect(llamadas[0]?.url).toBe(`${BASE}/next-api/public/estadisticas`);
  });

  it("falla con claridad ante una respuesta de error o inesperada", async () => {
    const error = new RealS5({
      baseUrl: BASE,
      envioAutorizado: false,
      fetchImpl: fetchFalso({}, 500).fetchImpl,
    });
    await expect(error.catalogo("faltas")).rejects.toThrow(/S5/);
    const forma = new RealS5({
      baseUrl: BASE,
      envioAutorizado: false,
      fetchImpl: fetchFalso({ otra: 1 }).fetchImpl,
    });
    await expect(forma.catalogo("faltas")).rejects.toThrow(/S5/);
  });

  it("sin autorización explícita no envía nada a la red", async () => {
    const { llamadas, fetchImpl } = fetchFalso({});
    const s5 = new RealS5({ baseUrl: BASE, envioAutorizado: false, fetchImpl });
    await expect(s5.registrarDenuncia(envio)).rejects.toThrow(/no autorizado/i);
    expect(llamadas).toHaveLength(0);
  });

  it("con autorización explícita usa la ruta conocida del entorno", async () => {
    const { llamadas, fetchImpl } = fetchFalso({ folio: "X" });
    const s5 = new RealS5({ baseUrl: BASE, envioAutorizado: true, fetchImpl });
    await s5.registrarDenuncia(envio);
    expect(llamadas).toEqual([{ url: `${BASE}/next-api/public/denuncias`, metodo: "POST" }]);
  });
});

describe("crearAdaptadorS5", () => {
  it("elige la implementación por configuración", () => {
    expect(
      crearAdaptadorS5({ adaptador: "mock", baseUrl: BASE, envioAutorizado: false }),
    ).toBeInstanceOf(MockS5);
    expect(
      crearAdaptadorS5({ adaptador: "real", baseUrl: BASE, envioAutorizado: false }),
    ).toBeInstanceOf(RealS5);
  });
});
