import {
  abrir,
  deBase64Url,
  generarParDeClaves,
  sellar,
  solicitudMensajeDenunciante,
} from "@dataton/shared";
import { describe, expect, it, vi } from "vitest";
import { MAX_MENSAJE, enviarMensaje } from "./enviar-mensaje";

const credencial = { tipo: "folio", folio: "BZ-0123-4567-89AB-CDEF" } as const;

const preparar = async () => {
  const claves = await generarParDeClaves();
  return {
    claves,
    d: {
      sellar,
      buzon: {
        obtenerConfiguracion: vi.fn(async () => ({
          clavePublicaAutoridad: claves.publica,
          maxBytesEvidencia: 1,
          maxEvidencias: 1,
          tiposEvidencia: [],
        })),
        enviarMensaje: vi.fn(async (_s: unknown) => undefined),
      },
      trabajo: { resolverPow: vi.fn(async () => "pow-1") },
    },
  };
};

describe("enviarMensaje", () => {
  it("sella el mensaje para la autoridad antes de enviarlo", async () => {
    const { claves, d } = await preparar();
    await enviarMensaje({ credencial, texto: "Tengo otro dato" }, d);
    const enviado = d.buzon.enviarMensaje.mock.calls[0]?.[0] as { cuerpoSellado: string };
    expect(solicitudMensajeDenunciante.safeParse(enviado).success).toBe(true);
    expect(JSON.stringify(enviado)).not.toContain("Tengo otro dato");
    const abierto = await abrir(claves.privada, deBase64Url(enviado.cuerpoSellado));
    expect(new TextDecoder().decode(abierto)).toBe("Tengo otro dato");
  });

  it("rechaza mensajes vacíos o demasiado largos sin tocar la red", async () => {
    const { d } = await preparar();
    await expect(enviarMensaje({ credencial, texto: "   " }, d)).rejects.toThrow(/Escribe/);
    await expect(
      enviarMensaje({ credencial, texto: "x".repeat(MAX_MENSAJE + 1) }, d),
    ).rejects.toThrow(/largo/);
    expect(d.buzon.enviarMensaje).not.toHaveBeenCalled();
  });
});
