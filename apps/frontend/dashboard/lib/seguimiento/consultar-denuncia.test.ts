import { ERROR_ACCESO } from "@dataton/shared";
import { describe, expect, it, vi } from "vitest";
import { ErrorApi } from "@/lib/api";
import { consultarDenuncia } from "./consultar-denuncia";

const MENSAJE = ERROR_ACCESO.error.message;
const FOLIO = "BZ-0123-4567-89AB-CDEF";
const respuesta = {
  etapaActual: "recibida",
  lineaTiempo: [{ etapa: "recibida", dia: "2026-11-01" }],
  mensajes: [],
};

const dependencias = () => ({
  buzon: { consultar: vi.fn(async (_s: unknown): Promise<unknown> => respuesta) },
  trabajo: {
    derivarAccesoId: vi.fn(async (_f: string) => "c".repeat(64)),
    resolverPow: vi.fn(async () => "pow-1"),
  },
});

describe("consultarDenuncia", () => {
  it("devuelve la consulta y la credencial, para reutilizarla solo en memoria", async () => {
    const d = dependencias();
    const r = await consultarDenuncia({ tipo: "folio", valor: FOLIO }, d);
    expect(r.consulta.etapaActual).toBe("recibida");
    expect(r.credencial).toEqual({ tipo: "folio", folio: FOLIO });
    expect(d.buzon.consultar).toHaveBeenCalledWith({
      pow: "pow-1",
      credencial: { tipo: "folio", folio: FOLIO },
    });
  });

  it("un 401 siempre muestra el mismo error, sin importar lo que diga el servidor", async () => {
    const d = dependencias();
    d.buzon.consultar.mockRejectedValueOnce(new ErrorApi(401, "otro texto"));
    await expect(consultarDenuncia({ tipo: "folio", valor: FOLIO }, d)).rejects.toThrow(MENSAJE);
  });

  it("una falla de red se distingue, porque no revela nada sobre la denuncia", async () => {
    const d = dependencias();
    d.buzon.consultar.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(consultarDenuncia({ tipo: "folio", valor: FOLIO }, d)).rejects.toThrow(/conectar/);
  });

  it("rechaza una respuesta fuera de contrato", async () => {
    const d = dependencias();
    d.buzon.consultar.mockResolvedValueOnce({ etapaActual: "inventada" });
    await expect(consultarDenuncia({ tipo: "folio", valor: FOLIO }, d)).rejects.toThrow();
  });
});
