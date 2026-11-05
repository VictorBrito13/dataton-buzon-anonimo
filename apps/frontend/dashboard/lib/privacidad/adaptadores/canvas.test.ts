import { afterEach, describe, expect, it, vi } from "vitest";
import { recodificarConCanvas } from "./canvas";

const SALIDA = Uint8Array.of(9, 9, 9);

interface Opciones {
  /** Simula navegadores que bloquean leer el canvas, como Tor Browser (devuelve blanco). */
  lecturaEnBlanco?: boolean;
  /** Simula Safari, que entrega PNG cuando se le pide WebP. */
  tipoEntregado?: string;
  sinContexto?: boolean;
  fallaDecodificar?: boolean;
}

const simularNavegador = (opciones: Opciones = {}) => {
  const pedidos: { opciones?: unknown; tipo?: string; dibujos: number } = { dibujos: 0 };
  const pixeles = new Uint8ClampedArray(16);
  const contexto = {
    fillStyle: "",
    fillRect: () => {
      if (!opciones.lecturaEnBlanco) {
        pixeles.set([10, 20, 30, 255]);
      }
    },
    getImageData: () => ({
      data: opciones.lecturaEnBlanco ? new Uint8ClampedArray(16).fill(255) : pixeles,
    }),
    drawImage: () => {
      pedidos.dibujos++;
    },
  };
  const lienzo = {
    width: 0,
    height: 0,
    getContext: () => (opciones.sinContexto ? null : contexto),
    toBlob: (alTerminar: (b: Blob | null) => void, tipo: string) => {
      pedidos.tipo = tipo;
      const blob = {
        type: opciones.tipoEntregado ?? tipo,
        arrayBuffer: async () => SALIDA.buffer,
      } as unknown as Blob;
      alTerminar(blob);
    },
  };
  vi.spyOn(document, "createElement").mockReturnValue(lienzo as unknown as HTMLElement);
  vi.stubGlobal("createImageBitmap", async (_blob: Blob, o: unknown) => {
    if (opciones.fallaDecodificar) throw new Error("no decodifica");
    pedidos.opciones = o;
    return { width: 4, height: 3, close: () => undefined };
  });
  return { pedidos, lienzo };
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("recodificarConCanvas", () => {
  it("sin createImageBitmap (jsdom) devuelve null para usar el limpiador de bytes", async () => {
    expect(await recodificarConCanvas(new Uint8Array(4), "jpeg")).toBeNull();
  });

  it("recodifica en el mismo formato y respeta la orientación", async () => {
    const { pedidos, lienzo } = simularNavegador();
    const salida = await recodificarConCanvas(new Uint8Array(4), "jpeg");
    expect(salida).toEqual(SALIDA);
    expect(pedidos.opciones).toMatchObject({ imageOrientation: "from-image" });
    expect(pedidos.tipo).toBe("image/jpeg");
    expect(pedidos.dibujos).toBe(1);
    expect([lienzo.width, lienzo.height]).toEqual([4, 3]);
  });

  it("no usa un canvas cuya lectura está bloqueada: destruiría la evidencia", async () => {
    simularNavegador({ lecturaEnBlanco: true });
    expect(await recodificarConCanvas(new Uint8Array(4), "jpeg")).toBeNull();
  });

  it("no acepta un formato distinto al pedido", async () => {
    simularNavegador({ tipoEntregado: "image/png" });
    expect(await recodificarConCanvas(new Uint8Array(4), "webp")).toBeNull();
  });

  it("devuelve null si no hay contexto 2D", async () => {
    simularNavegador({ sinContexto: true });
    expect(await recodificarConCanvas(new Uint8Array(4), "png")).toBeNull();
  });

  it("devuelve null si el navegador no puede decodificar la imagen", async () => {
    simularNavegador({ fallaDecodificar: true });
    expect(await recodificarConCanvas(new Uint8Array(4), "png")).toBeNull();
  });
});
