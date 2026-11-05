import { abrir, deBase64Url, generarParDeClaves, sellar, solicitudDenuncia } from "@dataton/shared";
import { describe, expect, it, vi } from "vitest";
import { ErrorApi } from "@/lib/api";
import { enviarDenuncia } from "./enviar-denuncia";

const FRASE = "ancla barco cielo dedo pera mesa";
const ACCESO = "a".repeat(64);
const FOLIO = "BZ-0123-4567-89AB-CDEF";
const ID = "6f1d2c3a-1111-4222-8333-444455556666";

const entrada = {
  hechos: {
    estado: "17",
    municipio: "",
    tipoFalta: "otra",
    enteId: "",
    cuando: "2026-03",
    relato: "Me pidieron dinero por un trámite.",
  },
  personas: [{ nombre: "Ventanilla 3", cargo: "" }],
  frase: FRASE,
  evidenciaIds: [ID],
};

const preparar = async () => {
  const claves = await generarParDeClaves();
  const buzon = {
    obtenerConfiguracion: vi.fn(async () => ({
      clavePublicaAutoridad: claves.publica,
      maxBytesEvidencia: 1000,
      maxEvidencias: 3,
      tiposEvidencia: [],
    })),
    crearDenuncia: vi.fn(async (_s: unknown) => ({ folio: FOLIO })),
  };
  const trabajo = {
    derivarAccesoId: vi.fn(async (_f: string) => ACCESO),
    resolverPow: vi.fn(async () => "pow-1"),
  };
  return { claves, dependencias: { buzon, trabajo, sellar } };
};

describe("enviarDenuncia", () => {
  it("devuelve el folio y envía una solicitud válida según el contrato", async () => {
    const { dependencias } = await preparar();
    await expect(enviarDenuncia(entrada, dependencias)).resolves.toBe(FOLIO);
    const enviada = dependencias.buzon.crearDenuncia.mock.calls[0]?.[0];
    expect(solicitudDenuncia.safeParse(enviada).success).toBe(true);
    expect(enviada).toMatchObject({
      pow: "pow-1",
      accesoId: ACCESO,
      estado: "17",
      tipoFalta: "otra",
      evidenciaIds: [ID],
    });
  });

  it("omite los campos opcionales vacíos", async () => {
    const { dependencias } = await preparar();
    await enviarDenuncia(entrada, dependencias);
    const enviada = dependencias.buzon.crearDenuncia.mock.calls[0]?.[0] as object;
    expect(enviada).not.toHaveProperty("municipio");
    expect(enviada).not.toHaveProperty("enteId");
  });

  it("la frase y el relato nunca viajan en claro", async () => {
    const { dependencias } = await preparar();
    await enviarDenuncia(entrada, dependencias);
    const serializada = JSON.stringify(dependencias.buzon.crearDenuncia.mock.calls[0]?.[0]);
    expect(serializada).not.toContain("ancla");
    expect(serializada).not.toContain("trámite");
    expect(serializada).not.toContain("Ventanilla");
    expect(dependencias.trabajo.derivarAccesoId).toHaveBeenCalledWith(FRASE);
  });

  it("el relato y las personas se abren solo con la clave de la autoridad", async () => {
    const { claves, dependencias } = await preparar();
    await enviarDenuncia(entrada, dependencias);
    const enviada = dependencias.buzon.crearDenuncia.mock.calls[0]?.[0] as {
      relatoSellado: string;
    };
    const abierto = await abrir(claves.privada, deBase64Url(enviada.relatoSellado));
    const texto = new TextDecoder().decode(abierto);
    expect(texto).toContain("Me pidieron dinero");
    expect(texto).toContain("Ventanilla 3");
    expect(texto).toContain("marzo de 2026");
  });

  it("la fecha aproximada nunca viaja como campo en claro", async () => {
    const { dependencias } = await preparar();
    await enviarDenuncia(entrada, dependencias);
    const enviada = dependencias.buzon.crearDenuncia.mock.calls[0]?.[0] as object;
    expect(enviada).not.toHaveProperty("cuando");
    expect(JSON.stringify(enviada)).not.toContain("2026-03");
  });

  it("anuncia cada etapa en orden para informar a la persona", async () => {
    const { dependencias } = await preparar();
    const etapas: string[] = [];
    await enviarDenuncia(entrada, dependencias, (e) => etapas.push(e));
    expect(etapas).toEqual(["sellando", "derivando", "verificando", "enviando"]);
  });

  it("deja pasar el error del servidor para poder reintentar", async () => {
    const { dependencias } = await preparar();
    dependencias.buzon.crearDenuncia.mockRejectedValueOnce(new ErrorApi(500, "Falla"));
    await expect(enviarDenuncia(entrada, dependencias)).rejects.toBeInstanceOf(ErrorApi);
  });

  it("no llama al servidor si los datos no cumplen el contrato", async () => {
    const { dependencias } = await preparar();
    await expect(
      enviarDenuncia({ ...entrada, evidenciaIds: ["no-uuid"] }, dependencias),
    ).rejects.toThrow();
    expect(dependencias.buzon.crearDenuncia).not.toHaveBeenCalled();
  });
});
