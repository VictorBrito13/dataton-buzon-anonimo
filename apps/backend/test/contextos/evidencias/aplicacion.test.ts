import { describe, expect, it } from "vitest";
import { LimpiarEvidenciasHuerfanas } from "../../../src/contextos/evidencias/aplicacion/limpiar-huerfanas.js";
import type {
  EvidenciaSellada,
  Limpiador,
  RepositorioEvidencias,
} from "../../../src/contextos/evidencias/aplicacion/puertos.js";
import { RecibirEvidencia } from "../../../src/contextos/evidencias/aplicacion/recibir-evidencia.js";

class RepositorioFalso implements RepositorioEvidencias {
  guardadas: EvidenciaSellada[] = [];
  eliminadasAntesDe: string | null = null;
  huerfanas = { filas: 0, bytes: 0 };
  guardar(evidencia: EvidenciaSellada): Promise<string> {
    this.guardadas.push(evidencia);
    return Promise.resolve("evidencia-1");
  }
  eliminarSinDenunciaAntesDe(dia: string): Promise<number> {
    this.eliminadasAntesDe = dia;
    return Promise.resolve(3);
  }
  usoHuerfanas(): Promise<{ filas: number; bytes: number }> {
    return Promise.resolve(this.huerfanas);
  }
}

const original = new TextEncoder().encode("original con GPS");
const limpio = new TextEncoder().encode("limpio");
const limpiadorOk: Limpiador = {
  limpiar: () => Promise.resolve({ bytes: limpio, eliminados: ["EXIF"], residuales: [] }),
};
const armar = (
  sobre: {
    tipo?: string | null;
    limpiador?: Limpiador;
    max?: number;
    cuota?: { filas: number; bytes: number };
  } = {},
): { repo: RepositorioFalso; caso: RecibirEvidencia; sellados: Uint8Array[] } => {
  const repo = new RepositorioFalso();
  const sellados: Uint8Array[] = [];
  const caso = new RecibirEvidencia(
    {
      detector: {
        detectar: () => Promise.resolve(sobre.tipo === undefined ? "image/jpeg" : sobre.tipo),
      },
      limpiador: sobre.limpiador ?? limpiadorOk,
      sellador: {
        sellar: (bytes) => {
          sellados.push(bytes);
          return Promise.resolve(new TextEncoder().encode("sellado"));
        },
      },
      repositorio: repo,
      reloj: { ahora: () => new Date("2026-05-02T18:44:12Z") },
    },
    { maxBytes: sobre.max ?? 1000, cuotaHuerfanas: sobre.cuota ?? { filas: 10, bytes: 10_000 } },
  );
  return { repo, caso, sellados };
};

const codigo = async (promesa: Promise<unknown>) =>
  promesa.then(
    () => undefined,
    (e: { codigo?: string }) => e.codigo,
  );

describe("RecibirEvidencia", () => {
  it("sella lo limpio, guarda solo el sello y reporta lo eliminado", async () => {
    const { repo, caso, sellados } = armar();
    expect(await caso.ejecutar(original)).toEqual({
      evidenciaId: "evidencia-1",
      metadatosEliminadosEnServidor: ["EXIF"],
    });
    expect(sellados).toEqual([limpio]);
    expect(repo.guardadas[0]).toEqual({
      tipo: "image/jpeg",
      blobSellado: new TextEncoder().encode("sellado"),
      subidaDia: "2026-05-02",
    });
  });

  it("usa el tipo real detectado y rechaza lo no permitido", async () => {
    const { repo, caso } = armar({ tipo: "application/x-msdownload" });
    expect(await codigo(caso.ejecutar(original))).toBe("tipo_no_permitido");
    expect(repo.guardadas).toHaveLength(0);
  });

  it("rechaza lo que no se reconoce por sus bytes", async () => {
    const { caso } = armar({ tipo: null });
    expect(await codigo(caso.ejecutar(original))).toBe("tipo_no_permitido");
  });

  it("rechaza por tamaño antes de procesar", async () => {
    const { caso } = armar({ max: 2 });
    expect(await codigo(caso.ejecutar(original))).toBe("evidencia_demasiado_grande");
  });

  it("cierra la recepción si las subidas sin denuncia agotan la cuota, sin limpiar ni guardar", async () => {
    const limpiezas: number[] = [];
    const limpiador: Limpiador = {
      limpiar: (_t, _c, bytes) => {
        limpiezas.push(bytes.length);
        return limpiadorOk.limpiar(_t, _c, bytes);
      },
    };
    const porFilas = armar({ limpiador, cuota: { filas: 2, bytes: 10_000 } });
    porFilas.repo.huerfanas = { filas: 2, bytes: 10 };
    expect(await codigo(porFilas.caso.ejecutar(original))).toBe("cuota_subidas_agotada");
    const porBytes = armar({ limpiador, cuota: { filas: 10, bytes: 100 } });
    porBytes.repo.huerfanas = { filas: 1, bytes: 100 };
    expect(await codigo(porBytes.caso.ejecutar(original))).toBe("cuota_subidas_agotada");
    expect(limpiezas).toEqual([]);
    expect(porFilas.repo.guardadas).toHaveLength(0);
    expect(porBytes.sellados).toHaveLength(0);
  });

  it("rechaza si quedan metadatos tras la limpieza", async () => {
    const { repo, caso, sellados } = armar({
      limpiador: {
        limpiar: () => Promise.resolve({ bytes: limpio, eliminados: [], residuales: ["XMP"] }),
      },
    });
    expect(await codigo(caso.ejecutar(original))).toBe("metadatos_residuales");
    expect(sellados).toHaveLength(0);
    expect(repo.guardadas).toHaveLength(0);
  });
});

describe("LimpiarEvidenciasHuerfanas", () => {
  it("borra las subidas sin denuncia de antes de ayer: nunca las del día anterior", async () => {
    const repo = new RepositorioFalso();
    const caso = new LimpiarEvidenciasHuerfanas({
      repositorio: repo,
      reloj: { ahora: () => new Date("2026-05-03T01:00:00Z") },
    });
    expect(await caso.ejecutar()).toBe(3);
    expect(repo.eliminadasAntesDe).toBe("2026-05-02");
  });
});
