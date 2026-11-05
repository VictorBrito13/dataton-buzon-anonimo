import { describe, expect, it, vi } from "vitest";
import { ErrorApi } from "@/lib/api";
import { ErrorLimpieza } from "@/lib/privacidad/dominio/limpieza/errores";
import { subirEvidencia } from "./subir-evidencia";

const limites = { maxBytesEvidencia: 1000, maxEvidencias: 3, tiposEvidencia: ["image/png"] };
const ID = "6f1d2c3a-1111-4222-8333-444455556666";
const original = new File(["contenido"], "foto-de-ana.png", { type: "image/png" });
const limpio = new File(["limpio"], "archivo.png", { type: "image/png" });

const dependencias = () => ({
  limpiar: vi.fn(async (_a: File) => ({ archivo: limpio, eliminados: ["Ubicación GPS"] })),
  trabajo: { resolverPow: vi.fn(async () => "pow-1") },
  buzon: {
    subirEvidencia: vi.fn(async (_a: File, _p: string) => ({
      evidenciaId: ID,
      metadatosEliminadosEnServidor: ["Autor"],
    })),
  },
});

describe("subirEvidencia", () => {
  it("limpia primero y sube solo el archivo limpio, con prueba de trabajo", async () => {
    const d = dependencias();
    const r = await subirEvidencia({ archivo: original, limites, cantidadActual: 0 }, d);
    expect(d.limpiar).toHaveBeenCalledWith(original);
    expect(d.buzon.subirEvidencia).toHaveBeenCalledWith(limpio, "pow-1");
    expect(r).toMatchObject({
      evidenciaId: ID,
      nombre: "foto-de-ana.png",
      eliminadosEnDispositivo: ["Ubicación GPS"],
      eliminadosEnServidor: ["Autor"],
    });
  });

  it("no sube nada si el archivo no pasa la validación", async () => {
    const d = dependencias();
    const malo = new File(["x"], "a.exe", { type: "application/x-msdownload" });
    await expect(subirEvidencia({ archivo: malo, limites, cantidadActual: 0 }, d)).rejects.toThrow(
      /tipo/,
    );
    expect(d.limpiar).not.toHaveBeenCalled();
    expect(d.buzon.subirEvidencia).not.toHaveBeenCalled();
  });

  it("no sube el original si la limpieza falla", async () => {
    const d = dependencias();
    d.limpiar.mockRejectedValueOnce(new Error("archivo dañado"));
    await expect(
      subirEvidencia({ archivo: original, limites, cantidadActual: 0 }, d),
    ).rejects.toThrow(/No pudimos limpiar/);
    expect(d.buzon.subirEvidencia).not.toHaveBeenCalled();
  });

  it("muestra tal cual el motivo que da la limpieza, escrito para la persona", async () => {
    const d = dependencias();
    d.limpiar.mockRejectedValueOnce(
      new ErrorLimpieza("Este archivo está protegido con contraseña."),
    );
    await expect(
      subirEvidencia({ archivo: original, limites, cantidadActual: 0 }, d),
    ).rejects.toThrow("Este archivo está protegido con contraseña.");
    expect(d.buzon.subirEvidencia).not.toHaveBeenCalled();
  });

  it("muestra el motivo del servidor cuando rechaza el archivo", async () => {
    const d = dependencias();
    d.buzon.subirEvidencia.mockRejectedValueOnce(
      new ErrorApi(415, "El archivo no es lo que dice."),
    );
    await expect(
      subirEvidencia({ archivo: original, limites, cantidadActual: 0 }, d),
    ).rejects.toThrow("El archivo no es lo que dice.");
  });
});
