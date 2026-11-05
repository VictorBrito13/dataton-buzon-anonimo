// @vitest-environment node
import { CLAVES_ESTADO, type FilaCobertura, type RespuestaCoberturaPdn } from "@dataton/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CoberturaPdn } from "./cobertura-pdn";

const conexion = (aplicables: number, conectados: number) => ({
  aplicables,
  conectados,
  porcentaje: aplicables === 0 ? null : Math.round((conectados / aplicables) * 1000) / 10,
});

const fila = (
  entidad: string | null,
  nombre: string,
  ambito: string | null = null,
): FilaCobertura => ({
  entidad,
  ambito,
  nombre,
  registros: 100,
  sujetosObligados: 60,
  organosControl: 40,
  tribunales: 0,
  s1: conexion(60, 30),
  s2: conexion(60, 15),
  s3: conexion(40, entidad === "26" ? 0 : 20),
  s6: conexion(60, 0),
  sinConexion: 25,
  porcentajeSinConexion: 25,
});

const datos: RespuestaCoberturaPdn = {
  fuente: {
    nombre: "Cobertura de la PDN",
    url: "https://cobertura.plataformadigitalnacional.org/directus/items/entes?limit=-1",
    consultadoEl: "2026-11-05",
    licencia: "No encontrada. Pendiente de confirmar con SESNA.",
  },
  datosSinteticos: false,
  kAnonimato: "no_aplica",
  avisos: ["Aviso de prueba sobre los límites."],
  ultimaModificacion: "2026-10-21",
  banderasFueraDeAlcance: 0,
  nacional: fila(null, "Nacional"),
  porAmbito: [
    fila(null, "Federal", "Federal"),
    fila(null, "Estatal", "Estatal"),
    fila(null, "Municipal", "Municipal"),
  ],
  porEntidad: [fila("00", "Federación"), ...CLAVES_ESTADO.map((c) => fila(c, `Estado ${c}`))],
  porEntidadAmbito: [],
  contrasteS3: {
    conRegistrosSinConexion: [{ estado: "29", registros: 77 }],
    conConexionSinRegistros: [{ estado: "04", conectados: 1 }],
  },
};

const pintar = (sistema: "s1" | "s2" | "s3" | "s6" = "s3") =>
  renderToStaticMarkup(
    <CoberturaPdn datos={datos} sistema={sistema} periodo="2026-T3" estado={null} />,
  );

describe("CoberturaPdn", () => {
  it("se etiqueta como datos reales", () => {
    expect(pintar()).toContain("Datos reales de la PDN");
  });

  it("explica que es cobertura de información, no conducta", () => {
    const html = pintar();
    expect(html).toMatch(/cobertura de información, no conducta/i);
    expect(html).toMatch(/no significa que no tenga sanciones/i);
    expect(html).toMatch(/No mide conducta ni riesgo de corrupción/);
  });

  it("no presenta ningún hallazgo como riesgo ni sospecha sobre un ente", () => {
    const sinLaAclaracion = pintar().replace(/No mide conducta ni riesgo de corrupción/g, "");
    expect(sinLaAclaracion).not.toMatch(/riesgo|sospech|opac|incumpl|irregular/i);
  });

  it("el selector es un enlace por sistema y marca el activo", () => {
    const html = pintar("s6");
    for (const s of ["s1", "s2", "s3", "s6"]) {
      expect(html).toContain(`cobertura=${s}#cobertura-pdn`);
    }
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="true"[^>]*>[^<]*(<[^>]+>)*S6/);
  });

  it("pinta una casilla por cada estado, con nombre y cifra, sin style=", () => {
    const html = pintar();
    expect(html.match(/<g /g)?.length).toBe(CLAVES_ESTADO.length);
    expect(html).toContain("<title>Estado 26: 0 de 40 conectados a S3 (0%).</title>");
    expect(html).not.toContain("style=");
  });

  it("un cero se distingue por su forma además del tono", () => {
    expect(pintar()).toContain("cobertura-cero");
  });

  it("tiene una tabla equivalente con los 32 estados, los cuatro sistemas y la Federación", () => {
    const html = pintar();
    expect(html).toContain("Cobertura por estado y sistema");
    expect(html).toContain('scope="col">S1<');
    expect(html).toContain('scope="col">S6<');
    expect(html).toContain("Estado 26");
    expect(html).toContain("Federación");
  });

  it("muestra el corte por ámbito", () => {
    const html = pintar();
    expect(html).toContain("Cobertura por ámbito de gobierno");
    expect(html).toContain("Municipal");
  });

  it("declara fuente, fecha, licencia y que k-anonimato no aplica", () => {
    const html = pintar();
    expect(html).toContain("2026-11-05");
    expect(html).toContain("Pendiente de confirmar con SESNA");
    expect(html).toMatch(/k-anonimato no aplica/);
    expect(html).toContain("Aviso de prueba sobre los límites.");
  });

  it("avisa que una bandera y los datos pueden no coincidir, con cifras", () => {
    const html = pintar();
    expect(html).toContain("Tlaxcala (77)");
    expect(html).toContain("Campeche");
  });

  it("enlaza las descargas y la API", () => {
    const html = pintar();
    expect(html).toContain("/api/v1/publico/descargas/cobertura-pdn.csv");
    expect(html).toContain("/api/v1/publico/descargas/cobertura-pdn.json");
    expect(html).toContain("/api/v1/publico/cobertura-pdn");
  });
});
