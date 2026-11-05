// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "@/lib/api";
import {
  cambiarEtapa,
  cerrarSesion,
  descargarEvidencia,
  esSesionVencida,
  iniciarSesion,
  listarDenuncias,
  mensajeDeError,
  obtenerDenuncia,
  responder,
} from "./api";

const ID = "6f1c1c1e-3f0a-4a53-9a55-0d3f6a1b2c3d";
const RESUMEN = {
  id: ID,
  estado: "17",
  municipio: null,
  tipoFalta: "cohecho",
  enteId: null,
  etapa: "recibida",
  recibidaDia: "2026-03-01",
};
const DETALLE = {
  ...RESUMEN,
  relatoSellado: "abc",
  lineaTiempo: [{ etapa: "recibida", dia: "2026-03-01" }],
  evidencias: [],
  mensajes: [],
};

const responderCon = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado });

const peticion = vi.fn<typeof fetch>();
const ultima = () => {
  const [url, opciones] = peticion.mock.calls.at(-1) as [string, RequestInit];
  return { url, opciones };
};

beforeEach(() => {
  peticion.mockReset();
  vi.stubGlobal("fetch", peticion);
});
afterEach(() => vi.unstubAllGlobals());

describe("todas las llamadas del panel", () => {
  it("envían la cookie de mismo origen", async () => {
    const llamadas: Array<[unknown, () => Promise<unknown>]> = [
      [{ denuncias: [RESUMEN], total: 1 }, () => listarDenuncias()],
      [DETALLE, () => obtenerDenuncia(ID)],
      [{}, () => iniciarSesion({ usuario: "a", contrasena: "b" })],
      [{}, () => cerrarSesion()],
      [{}, () => cambiarEtapa(ID, "turnada_investigadora")],
      [{}, () => responder(ID, "hola")],
    ];
    for (const [cuerpo, llamar] of llamadas) {
      peticion.mockResolvedValueOnce(responderCon(cuerpo));
      await llamar();
      expect(ultima().opciones.credentials).toBe("same-origin");
    }
    peticion.mockResolvedValueOnce(new Response(new Uint8Array([1])));
    await descargarEvidencia(ID, ID);
    expect(ultima().opciones.credentials).toBe("same-origin");
  });
});

describe("listarDenuncias y obtenerDenuncia", () => {
  it("el listado conserva el total para poder avisar si está recortado", async () => {
    peticion.mockResolvedValueOnce(responderCon({ denuncias: [RESUMEN], total: 7 }));
    expect((await listarDenuncias()).total).toBe(7);
  });

  it("descartan cualquier campo fuera del contrato, como datos de quien denuncia", async () => {
    peticion.mockResolvedValueOnce(
      responderCon({ denuncias: [{ ...RESUMEN, ip: "203.0.113.9" }], total: 1 }),
    );
    expect((await listarDenuncias()).denuncias[0]).not.toHaveProperty("ip");

    peticion.mockResolvedValueOnce(responderCon({ ...DETALLE, correo: "x@y.mx" }));
    expect(await obtenerDenuncia(ID)).not.toHaveProperty("correo");
  });

  it("rechazan una respuesta que no cumple el contrato", async () => {
    peticion.mockResolvedValueOnce(responderCon({ denuncias: [{ id: "no-uuid" }], total: 1 }));
    await expect(listarDenuncias()).rejects.toThrow();
    peticion.mockResolvedValueOnce(responderCon({ denuncias: [RESUMEN] }));
    await expect(listarDenuncias()).rejects.toThrow();
  });
});

describe("acciones", () => {
  it("cambiarEtapa envía solo la etapa destino", async () => {
    peticion.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await cambiarEtapa(ID, "turnada_investigadora");
    expect(JSON.parse(ultima().opciones.body as string)).toEqual({
      etapa: "turnada_investigadora",
    });
    expect(ultima().url).toContain(ID);
  });

  it("responder rechaza mensajes en blanco sin llamar al servidor", async () => {
    await expect(responder(ID, "   ")).rejects.toThrow();
    expect(peticion).not.toHaveBeenCalled();
  });

  it("descargarEvidencia devuelve los bytes sellados", async () => {
    peticion.mockResolvedValueOnce(new Response(new Uint8Array([9, 8, 7])));
    expect(await descargarEvidencia(ID, ID)).toEqual(new Uint8Array([9, 8, 7]));
  });

  it("descargarEvidencia traduce un 401 a ErrorApi", async () => {
    peticion.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const error = await descargarEvidencia(ID, ID).catch((e: unknown) => e);
    expect(esSesionVencida(error)).toBe(true);
  });
});

describe("errores", () => {
  it("solo un 401 es sesión vencida", () => {
    expect(esSesionVencida(new ErrorApi(401, "x"))).toBe(true);
    expect(esSesionVencida(new ErrorApi(403, "x"))).toBe(false);
    expect(esSesionVencida(new Error("x"))).toBe(false);
  });

  it("muestra el mensaje del servidor y oculta el resto", () => {
    expect(mensajeDeError(new ErrorApi(409, "Etapa no válida"))).toBe("Etapa no válida");
    expect(mensajeDeError(new SyntaxError("Unexpected token <"))).not.toContain("token");
  });
});
