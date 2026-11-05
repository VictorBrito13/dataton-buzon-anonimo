import { CLAVES_ESTADO, CLAVES_TIPO_FALTA, ETAPAS, TRANSICIONES } from "@dataton/shared";
import type { Etapa } from "@dataton/shared";
import { describe, expect, it } from "vitest";
import { generarDenunciasSinteticas, type Catalogo } from "./generador-sintetico.js";

const catalogo: Catalogo = {
  municipios: Array.from({ length: 40 }, (_, i) => ({
    clave: `17${String(i + 1).padStart(3, "0")}`,
    estado: "17",
  })).concat({ clave: "14039", estado: "14" }, { clave: "01001", estado: "01" }),
  municipiosGrandes: ["14039", "17007"],
  entes: [
    { id: "ente-ficticio-01", peso: 10 },
    { id: "ente-ficticio-02", peso: 1 },
  ],
};

const opciones = {
  semilla: 2026,
  desde: "2026-T1",
  hasta: "2026-T2",
  denunciasPorTrimestre: 1500,
  hoy: "2026-11-04",
};

describe("generador sintético", () => {
  const denuncias = generarDenunciasSinteticas(catalogo, opciones);

  it("es determinista por semilla", () => {
    expect(generarDenunciasSinteticas(catalogo, opciones)).toEqual(denuncias);
    expect(generarDenunciasSinteticas(catalogo, { ...opciones, semilla: 1 })).not.toEqual(
      denuncias,
    );
  });

  it("marca todo registro como sintético", () => {
    expect(denuncias.every((d) => d.sintetica === true)).toBe(true);
  });

  it("genera el volumen pedido por trimestre, dentro del periodo", () => {
    expect(denuncias.length).toBe(3000);
    for (const d of denuncias) {
      expect(d.recibidaDia >= "2026-01-01" && d.recibidaDia <= "2026-06-30").toBe(true);
    }
  });

  it("solo usa claves de los catálogos", () => {
    const municipios = new Set(catalogo.municipios.map((m) => m.clave));
    for (const d of denuncias) {
      expect(CLAVES_ESTADO).toContain(d.estado);
      expect(CLAVES_TIPO_FALTA).toContain(d.tipoFalta);
      if (d.municipio) {
        expect(municipios.has(d.municipio)).toBe(true);
        expect(d.municipio.slice(0, 2)).toBe(d.estado);
      }
    }
  });

  it("recorre solo transiciones válidas, con fechas no decrecientes hasta hoy", () => {
    for (const d of denuncias) {
      expect(d.etapas[0]?.etapa).toBe("recibida");
      expect(d.etapas[0]?.dia).toBe(d.recibidaDia);
      for (let i = 1; i < d.etapas.length; i += 1) {
        const previa = d.etapas[i - 1];
        const actual = d.etapas[i];
        if (!previa || !actual) throw new Error("etapa ausente");
        expect(TRANSICIONES[previa.etapa]).toContain(actual.etapa);
        expect(actual.dia >= previa.dia).toBe(true);
        expect(actual.dia <= opciones.hoy).toBe(true);
      }
    }
  });

  it("alcanza etapas variadas, incluidas las terminales", () => {
    const finales = new Set<Etapa>(denuncias.map((d) => d.etapas.at(-1)?.etapa as Etapa));
    expect(finales.size).toBeGreaterThanOrEqual(5);
    expect([...finales].some((e) => ETAPAS[e].terminal)).toBe(true);
  });

  it("concentra denuncias en municipios grandes y deja pocas en los pequeños", () => {
    const porMunicipio = new Map<string, number>();
    for (const d of denuncias) {
      if (d.municipio) porMunicipio.set(d.municipio, (porMunicipio.get(d.municipio) ?? 0) + 1);
    }
    const grande = porMunicipio.get("17007") ?? 0;
    const pequenos = catalogo.municipios
      .filter((m) => m.estado === "17" && m.clave !== "17007")
      .map((m) => porMunicipio.get(m.clave) ?? 0);
    expect(grande).toBeGreaterThan(Math.max(...pequenos) * 2);
    expect(Math.min(...pequenos)).toBeLessThan(5);
  });

  it("incluye casos sin municipio y sin ente, opcionales en el formulario", () => {
    expect(denuncias.some((d) => d.municipio === null)).toBe(true);
    expect(denuncias.some((d) => d.enteId === null)).toBe(true);
  });

  it("registra respuesta de la autoridad solo después de la recepción", () => {
    const conRespuesta = denuncias.filter((d) => d.respuestaDia !== null);
    expect(conRespuesta.length).toBeGreaterThan(0);
    expect(conRespuesta.length).toBeLessThan(denuncias.length);
    for (const d of conRespuesta) expect((d.respuestaDia ?? "") >= d.recibidaDia).toBe(true);
  });
});
