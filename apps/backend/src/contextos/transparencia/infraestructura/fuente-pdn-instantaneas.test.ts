import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { respuestaCoberturaPdn, respuestaPdn } from "@dataton/shared";
import { describe, expect, it } from "vitest";
import { crearFuentePdnInstantaneas } from "./fuente-pdn-instantaneas.js";

const fuente = crearFuentePdnInstantaneas();
const cobertura = respuestaCoberturaPdn.parse(fuente.cobertura());

describe("instantánea versionada de Cobertura", () => {
  it("cumple el contrato y declara su fuente, fecha y licencia pendiente", () => {
    expect(cobertura.fuente.url).toContain("cobertura.plataformadigitalnacional.org");
    expect(cobertura.fuente.consultadoEl).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(cobertura.fuente.licencia).toMatch(/Pendiente de confirmar con SESNA/);
    expect(cobertura.datosSinteticos).toBe(false);
    expect(cobertura.kAnonimato).toBe("no_aplica");
  });

  it("reproduce los denominadores del tablero oficial", () => {
    const { nacional } = cobertura;
    expect(nacional.registros).toBe(10_144);
    expect(nacional.sujetosObligados).toBe(6_231);
    expect(nacional.organosControl).toBe(3_880);
    expect(nacional.tribunales).toBe(33);
    expect(nacional.s1).toEqual({ aplicables: 6_264, conectados: 2_797, porcentaje: 44.7 });
    expect(nacional.s2).toEqual({ aplicables: 6_264, conectados: 2_591, porcentaje: 41.4 });
    expect(nacional.s3).toEqual({ aplicables: 3_913, conectados: 1_088, porcentaje: 27.8 });
    expect(nacional.s6).toEqual({ aplicables: 6_264, conectados: 438, porcentaje: 7 });
    expect(nacional.sinConexion).toBe(5_451);
  });

  it("no encontró banderas fuera de los sistemas que corresponden a cada tipo", () => {
    expect(cobertura.banderasFueraDeAlcance).toBe(0);
  });

  it("cubre las 32 entidades más la Federación y los tres ámbitos", () => {
    expect(cobertura.porEntidad).toHaveLength(33);
    expect(cobertura.porEntidad[0]?.entidad).toBe("00");
    expect(cobertura.porAmbito.map((f) => f.ambito)).toEqual(["Federal", "Estatal", "Municipal"]);
    expect(cobertura.porEntidadAmbito.length).toBeGreaterThan(33);
  });

  it("cada corte suma lo mismo que el total nacional", () => {
    const { nacional, porEntidad, porAmbito, porEntidadAmbito } = cobertura;
    for (const corte of [porEntidad, porAmbito, porEntidadAmbito]) {
      expect(corte.reduce((s, f) => s + f.registros, 0)).toBe(nacional.registros);
      expect(corte.reduce((s, f) => s + f.sinConexion, 0)).toBe(nacional.sinConexion);
      for (const sistema of ["s1", "s2", "s3", "s6"] as const) {
        expect(corte.reduce((s, f) => s + f[sistema].conectados, 0)).toBe(
          nacional[sistema].conectados,
        );
        expect(corte.reduce((s, f) => s + f[sistema].aplicables, 0)).toBe(
          nacional[sistema].aplicables,
        );
      }
    }
  });

  it("contrasta las banderas con la instantánea de S3, sin cruzar nombres", () => {
    expect(cobertura.contrasteS3.conRegistrosSinConexion).toEqual([
      { estado: "29", registros: 77 },
      { estado: "32", registros: 124 },
    ]);
    expect(cobertura.contrasteS3.conConexionSinRegistros).toEqual([
      { estado: "04", conectados: 1 },
      { estado: "22", conectados: 4 },
    ]);
  });

  it("el archivo versionado solo trae agregados: ni nombres de entes ni identificadores", () => {
    const archivo = readFileSync(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../../../datos/pdn/cobertura-resumen.json",
      ),
      "utf8",
    );
    expect(archivo).not.toMatch(/AYUNTAMIENTO|MUNICIPIO DE|SECRETARIA|"id"|"nombreEnte"/i);
  });

  it("el resumen de /pdn sigue citando la fuente de Cobertura", () => {
    const resumen = respuestaPdn.parse(fuente.resumen());
    expect(resumen.fuentes.map((f) => f.url)).toContain(cobertura.fuente.url);
  });
});
