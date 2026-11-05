import {
  respuestaAgregados,
  respuestaCoberturaPdn,
  respuestaIndicadores,
  respuestaMetodologia,
  respuestaPdn,
  respuestaPeriodos,
} from "@dataton/shared";
import express from "express";
import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FilaAgregado, LecturaAgregados } from "../aplicacion/puertos.js";
import { agregarCobertura } from "../dominio/cobertura.js";
import { calcularIndicadoresEnte } from "../dominio/indicadores.js";
import { crearRutasPublicas } from "./rutas-publicas.js";

const cuerpoDe = (r: { body: unknown }) =>
  r.body as {
    celdas: unknown[];
    dimensiones: string[];
    municipios: unknown[];
    diccionario: { campos: { campo: string }[] };
    datosSinteticos: boolean;
    filas: unknown[];
    campos: unknown[];
  };

const filas: FilaAgregado[] = [
  { dimensiones: "total", claves: {}, conteo: 100, motivo: "publicada", k: 5 },
  { dimensiones: "estado", claves: { estado: "17" }, conteo: 60, motivo: "publicada", k: 5 },
  { dimensiones: "estado", claves: { estado: "06" }, conteo: null, motivo: "menor_a_k", k: 5 },
  {
    dimensiones: "estado,tipoFalta",
    claves: { estado: "17", tipoFalta: "cohecho" },
    conteo: 12,
    motivo: "publicada",
    k: 5,
  },
  {
    dimensiones: "indicador_ente",
    claves: { ente: "ficticio-01" },
    conteo: null,
    motivo: "publicada",
    k: 5,
    detalle: calcularIndicadoresEnte(
      {
        ente: "ficticio-01",
        total: { conteo: 50, motivo: "publicada" },
        porEtapa: {
          recibida: { conteo: 10, motivo: "publicada" },
          en_investigacion: { conteo: 35, motivo: "publicada" },
          archivada: { conteo: 5, motivo: "publicada" },
        },
        conRespuesta: 40,
        tiempos: {},
      },
      { k: 5 },
    ),
  },
];

const lectura: LecturaAgregados = {
  listarPeriodos: () => Promise.resolve([{ periodo: "2026-T3", k: 5 }]),
  leerTabla: (periodo, dimensiones) =>
    Promise.resolve(
      periodo === "2026-T3" ? filas.filter((f) => f.dimensiones === dimensiones) : [],
    ),
  leerPeriodo: (periodo) => Promise.resolve(periodo === "2026-T3" ? filas : []),
};

const pdn = {
  resumen: () => ({
    fuentes: [
      { nombre: "S3", url: "https://ejemplo.invalid", consultadoEl: "2026-11-04", licencia: "x" },
    ],
    advertencias: ["prueba de concepto"],
    s3: {
      umbralPorInstitucion: 5,
      registrosSinInstitucion: 38,
      registrosConNombreNoInterpretable: 1,
      porEstado: [],
      instituciones: [],
    },
    s6: { compradores: 0, procedimientos: 0, mayores: [] },
    cruce: { coincidencias: [], homonimosDescartados: 0, sinJurisdiccionConocida: 0 },
  }),
  cobertura: () => ({
    fuente: {
      nombre: "Cobertura",
      url: "https://ejemplo.invalid",
      consultadoEl: "2026-11-05",
      licencia: "Pendiente de confirmar con SESNA.",
    },
    datosSinteticos: false as const,
    kAnonimato: "no_aplica" as const,
    avisos: ["Cobertura de información, no conducta."],
    contrasteS3: { conRegistrosSinConexion: [], conConexionSinRegistros: [] },
    ...agregarCobertura([
      {
        ambitoGobierno: "Estatal",
        controlOIC: false,
        controlTribunal: false,
        sistema1: true,
        sistema2: false,
        sistema3: false,
        sistema6: false,
        entidad: "17",
        date_created: "2026-10-20T00:00:00.000Z",
        date_updated: null,
      },
    ]),
  }),
};

const leerPeriodoEspia = vi.spyOn(lectura, "leerPeriodo");
const leerTablaEspia = vi.spyOn(lectura, "leerTabla");

const app = express();
beforeAll(() => {
  app.use(
    crearRutasPublicas({
      lectura,
      pdn,
      k: 5,
      rezagoDias: 14,
      municipios: () => [{ clave: "17007", nombre: "Cuernavaca" }],
    }),
  );
});

describe("GET /agregados", () => {
  it("responde según el contrato, con el total del recorte", async () => {
    const r = await request(app).get("/agregados?dimensiones=estado&periodo=2026-T3");
    expect(r.status).toBe(200);
    const cuerpo = respuestaAgregados.parse(r.body);
    expect(cuerpo.total).toBe(100);
    expect(cuerpo.k).toBe(5);
    expect(cuerpo.celdas).toHaveLength(2);
  });

  it("una celda oculta sale sin su valor", async () => {
    const r = await request(app).get("/agregados?dimensiones=estado&periodo=2026-T3");
    expect(cuerpoDe(r).celdas).toContainEqual({
      claves: { estado: "06" },
      conteo: null,
      motivo: "menor_a_k",
    });
  });

  it("acepta las dimensiones en cualquier orden", async () => {
    const r = await request(app).get("/agregados?dimensiones=tipoFalta,estado&periodo=2026-T3");
    expect(r.status).toBe(200);
    expect(cuerpoDe(r).dimensiones).toEqual(["estado", "tipoFalta"]);
  });

  it("rechaza tres dimensiones", async () => {
    const r = await request(app).get("/agregados?dimensiones=estado,etapa,ente&periodo=2026-T3");
    expect(r.status).toBe(400);
  });

  it("rechaza un cruce fuera del plan de publicación", async () => {
    const r = await request(app).get("/agregados?dimensiones=municipio,etapa&periodo=2026-T3");
    expect(r.status).toBe(400);
  });

  it("rechaza periodos que no son un trimestre", async () => {
    const r = await request(app).get("/agregados?dimensiones=estado&periodo=2026");
    expect(r.status).toBe(400);
  });

  it("responde 404 si el trimestre no está publicado", async () => {
    const r = await request(app).get("/agregados?dimensiones=estado&periodo=2030-T1");
    expect(r.status).toBe(404);
  });

  it("no expone las filas de indicadores como si fueran una tabla", async () => {
    const r = await request(app).get("/agregados?dimensiones=indicador_ente&periodo=2026-T3");
    expect(r.status).toBe(400);
  });
});

describe("GET /periodos, /metodologia, /indicadores, /pdn", () => {
  it("lista los periodos y avisa que los datos son sintéticos", async () => {
    const r = await request(app).get("/periodos");
    const cuerpo = respuestaPeriodos.parse(r.body);
    expect(cuerpo.periodos[0]?.periodo).toBe("2026-T3");
    expect(cuerpo.datosSinteticos).toBe(true);
  });

  it("la metodología ejecuta el ataque de la propuesta con el motor real", async () => {
    const r = await request(app).get("/metodologia");
    const cuerpo = respuestaMetodologia.parse(r.body);
    expect(cuerpo.ejemploAtaque.protegida.at(-1)?.cohecho).toBeNull();
    expect(cuerpo.ejemploAtaque.rango).toEqual({ min: 1, max: 4 });
    expect(cuerpo.noCubre.length).toBeGreaterThan(0);
  });

  it("indicadores: señal, nunca acusación", async () => {
    const r = await request(app).get("/indicadores?periodo=2026-T3");
    const cuerpo = respuestaIndicadores.parse(r.body);
    expect(cuerpo.aviso).toMatch(/nunca una acusación/);
    expect(cuerpo.entes[0]?.etiqueta).toMatch(/ficticio/);
    expect(cuerpo.entes[0]?.porcentajeConRespuesta).toBe(80);
    expect(cuerpo.entes[0]?.motivo).toBe("publicado");
  });

  it("pdn: conteos con su fuente", async () => {
    const r = await request(app).get("/pdn");
    expect(respuestaPdn.parse(r.body).fuentes[0]?.consultadoEl).toBe("2026-11-04");
  });

  it("municipios: catálogo servido desde el mismo origen", async () => {
    const r = await request(app).get("/catalogos/municipios?estado=17");
    expect(cuerpoDe(r).municipios).toEqual([{ clave: "17007", nombre: "Cuernavaca" }]);
  });
});

describe("cobertura de la PDN: otra fuente, fuera del motor de k-anonimato", () => {
  it("GET /cobertura-pdn responde según el contrato y se puede cachear", async () => {
    const r = await request(app).get("/cobertura-pdn");
    expect(r.status).toBe(200);
    expect(r.headers["cache-control"]).toBe("public, max-age=300");
    const cuerpo = respuestaCoberturaPdn.parse(r.body);
    expect(cuerpo.kAnonimato).toBe("no_aplica");
    expect(cuerpo.datosSinteticos).toBe(false);
    expect(cuerpo.nacional.s1.conectados).toBe(1);
  });

  it("descarga en CSV, con su nombre de archivo", async () => {
    const r = await request(app).get("/descargas/cobertura-pdn.csv");
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/text\/csv/);
    expect(r.headers["content-disposition"]).toContain("cobertura-pdn.csv");
    expect(r.text.split("\n")[0]).toMatch(/^corte,entidad,ambito,nombre,registros,/);
    expect(r.text).toContain("entidad,17,,Morelos,1,1,0,0,");
  });

  it("descarga en JSON, con su fuente y su diccionario", async () => {
    const r = await request(app).get("/descargas/cobertura-pdn.json");
    expect(r.status).toBe(200);
    expect(r.headers["content-disposition"]).toContain("cobertura-pdn.json");
    const { diccionario, ...datos } = r.body as Record<string, unknown> & {
      diccionario: { campos: { campo: string }[] };
    };
    expect(respuestaCoberturaPdn.parse(datos).fuente.consultadoEl).toBe("2026-11-05");
    expect(diccionario.campos.map((c) => c.campo)).toContain("s3_conectados");
  });

  it("el diccionario de datos describe el conjunto y sus límites", async () => {
    const r = await request(app).get("/descargas/diccionario.json");
    const { cobertura } = r.body as {
      cobertura: { descripcion: string; licencia: string; campos: { campo: string }[] };
    };
    expect(cobertura.descripcion).toMatch(/no de denuncias/);
    expect(cobertura.licencia).toMatch(/Pendiente de confirmar con SESNA/);
    expect(cobertura.campos.map((c) => c.campo)).toEqual(
      expect.arrayContaining(["corte", "s3_aplicables", "sin_conexion", "k_anonimato"]),
    );
  });

  it("no toca los agregados de denuncias", async () => {
    leerPeriodoEspia.mockClear();
    leerTablaEspia.mockClear();
    await request(app).get("/cobertura-pdn");
    await request(app).get("/descargas/cobertura-pdn.csv");
    await request(app).get("/descargas/cobertura-pdn.json");
    expect(leerPeriodoEspia).not.toHaveBeenCalled();
    expect(leerTablaEspia).not.toHaveBeenCalled();
  });

  it("las descargas de denuncias no llevan cifras de cobertura", async () => {
    const csv = await request(app).get("/descargas/agregados.csv?periodo=2026-T3");
    const json = await request(app).get("/descargas/agregados.json?periodo=2026-T3");
    expect(csv.text).not.toMatch(/cobertura|s3_conectados/i);
    expect(JSON.stringify((json.body as { filas: unknown[] }).filas)).not.toMatch(
      /cobertura|s3_conectados/i,
    );
  });

  it("la metodología aclara que k-anonimato no aplica a Cobertura, sin cambiar la garantía", async () => {
    const r = await request(app).get("/metodologia");
    const cuerpo = respuestaMetodologia.parse(r.body);
    expect(cuerpo.alcanceCobertura).toMatch(/No aplica a la cobertura/);
    expect(cuerpo.alcanceCobertura).toMatch(/entes/);
    expect(cuerpo.garantia).not.toMatch(/cobertura/i);
    expect(cuerpo.tablas.join(" ")).not.toMatch(/cobertura/i);
  });
});

describe("descargas", () => {
  it("CSV con una fila por celda y el valor oculto vacío", async () => {
    const r = await request(app).get("/descargas/agregados.csv?periodo=2026-T3");
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/text\/csv/);
    expect(r.headers["content-disposition"]).toMatch(/attachment/);
    const lineas = r.text.trim().split("\n");
    expect(lineas[0]).toBe(
      "periodo,tabla,estado,municipio,tipoFalta,etapa,ente,conteo,motivo,k,datos_sinteticos",
    );
    expect(lineas).toContain("2026-T3,estado,06,,,,,,menor_a_k,5,true");
    expect(r.text).not.toContain("indicador_ente");
  });

  it("JSON con las filas y el diccionario de datos", async () => {
    const r = await request(app).get("/descargas/agregados.json?periodo=2026-T3");
    expect(cuerpoDe(r).diccionario.campos.map((c) => c.campo)).toContain("motivo");
    expect(cuerpoDe(r).datosSinteticos).toBe(true);
    expect(cuerpoDe(r).filas.length).toBe(4);
  });

  it("las descargas se pueden cachear como el resto de lo público: un trimestre publicado no cambia", async () => {
    for (const ruta of [
      "/descargas/agregados.csv?periodo=2026-T3",
      "/descargas/agregados.json?periodo=2026-T3",
      "/descargas/diccionario.json",
    ]) {
      const r = await request(app).get(ruta);
      expect(r.status, ruta).toBe(200);
      expect(r.headers["cache-control"], ruta).toBe("public, max-age=300");
    }
  });

  it("publica el diccionario de datos por separado", async () => {
    const r = await request(app).get("/descargas/diccionario.json");
    expect(r.status).toBe(200);
    expect(cuerpoDe(r).campos.length).toBeGreaterThan(5);
  });

  it("responde 404 para un trimestre no publicado", async () => {
    const r = await request(app).get("/descargas/agregados.csv?periodo=2030-T1");
    expect(r.status).toBe(404);
  });
});
