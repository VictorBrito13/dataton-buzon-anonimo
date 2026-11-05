import { ENTES_SINTETICOS, esquemaDimension, esquemaPeriodo } from "@dataton/shared";
import type { Dimension, RespuestaAgregados, RespuestaIndicadores } from "@dataton/shared";
import { Router, type Response } from "express";
import { HttpError } from "../../../errors/http-error.js";
import { TABLA_INDICADORES } from "../aplicacion/agregar-periodos.js";
import type { FilaAgregado, FuenteDatosPdn, LecturaAgregados } from "../aplicacion/puertos.js";
import type { IndicadoresEnte } from "../dominio/indicadores.js";
import { DATOS_SINTETICOS, metodologia } from "../dominio/metodologia.js";
import { normalizarDimensiones, TABLA_TOTAL, TABLAS_PUBLICADAS } from "../dominio/publicacion.js";
import { DICCIONARIO_DATOS } from "./diccionario-datos.js";

export interface DependenciasPublicas {
  lectura: LecturaAgregados;
  pdn: FuenteDatosPdn;
  k: number;
  rezagoDias: number;
  municipios: (estado: string) => { clave: string; nombre: string }[];
}

export const AVISO_INDICADORES =
  "Señal para priorizar revisión, nunca una acusación. Un indicador no prueba ninguna falta: solo sugiere dónde mirar primero.";

const COLUMNAS_DIMENSION = ["estado", "municipio", "tipoFalta", "etapa", "ente"] as const;
const ETIQUETAS_ENTE = new Map<string, string>(ENTES_SINTETICOS.map((e) => [e.id, e.etiqueta]));

const leerPeriodo = (valor: unknown): string => {
  const periodo = esquemaPeriodo.safeParse(valor);
  if (!periodo.success) throw new HttpError(400, "periodo debe ser un trimestre, como 2026-T3");
  return periodo.data;
};

const leerDimensiones = (valor: unknown): Dimension[] => {
  const crudas = typeof valor === "string" ? valor.split(",") : [];
  const dimensiones = crudas.map((d) => esquemaDimension.safeParse(d));
  if (dimensiones.length === 0 || dimensiones.some((d) => !d.success)) {
    throw new HttpError(400, "dimensiones no válidas");
  }
  const lista = dimensiones.flatMap((d) => (d.success ? [d.data] : []));
  let tabla: string;
  try {
    tabla = normalizarDimensiones(lista);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "dimensiones no válidas");
  }
  if (!(TABLAS_PUBLICADAS as readonly string[]).includes(tabla)) {
    throw new HttpError(
      400,
      `Este cruce no se publica. Disponibles: ${TABLAS_PUBLICADAS.join("; ")}`,
    );
  }
  return tabla.split(",") as Dimension[];
};

const noPublicado = (periodo: string): HttpError =>
  new HttpError(404, `El trimestre ${periodo} no está publicado`);

const cachearPublico = (res: Response): void => {
  res.setHeader("Cache-Control", "public, max-age=300");
};

const comoCsv = (periodo: string, filas: readonly FilaAgregado[]): string => {
  const cabecera = [
    "periodo",
    "tabla",
    ...COLUMNAS_DIMENSION,
    "conteo",
    "motivo",
    "k",
    "datos_sinteticos",
  ];
  const lineas = filas.map((f) =>
    [
      periodo,
      f.dimensiones.replace(",", "*"),
      ...COLUMNAS_DIMENSION.map((d) => f.claves[d] ?? ""),
      f.conteo ?? "",
      f.motivo,
      f.k,
      DATOS_SINTETICOS,
    ].join(","),
  );
  return `${[cabecera.join(","), ...lineas].join("\n")}\n`;
};

const soloTablas = (filas: readonly FilaAgregado[]): FilaAgregado[] =>
  filas.filter((f) => f.dimensiones !== TABLA_INDICADORES);

export const crearRutasPublicas = ({
  lectura,
  pdn,
  k,
  rezagoDias,
  municipios,
}: DependenciasPublicas): Router => {
  const rutas = Router();

  const filasDelPeriodo = async (valor: unknown): Promise<[string, FilaAgregado[]]> => {
    const periodo = leerPeriodo(valor);
    const filas = await lectura.leerPeriodo(periodo);
    if (filas.length === 0) throw noPublicado(periodo);
    return [periodo, filas];
  };

  rutas.get("/periodos", async (_req, res) => {
    cachearPublico(res);
    res.json({
      periodos: await lectura.listarPeriodos(),
      rezagoDias,
      datosSinteticos: DATOS_SINTETICOS,
    });
  });

  rutas.get("/agregados", async (req, res) => {
    const dimensiones = leerDimensiones(req.query.dimensiones);
    const periodo = leerPeriodo(req.query.periodo);
    const [filas, total] = await Promise.all([
      lectura.leerTabla(periodo, dimensiones.join(",")),
      lectura.leerTabla(periodo, TABLA_TOTAL),
    ]);
    const primera = filas[0];
    if (!primera) throw noPublicado(periodo);
    const cuerpo: RespuestaAgregados = {
      k: primera.k,
      periodo,
      dimensiones,
      celdas: filas.map(({ claves, conteo, motivo }) => ({ claves, conteo, motivo })),
      total: total[0]?.conteo ?? null,
    };
    cachearPublico(res);
    res.json(cuerpo);
  });

  rutas.get("/indicadores", async (req, res) => {
    const periodo = leerPeriodo(req.query.periodo);
    const filas = await lectura.leerTabla(periodo, TABLA_INDICADORES);
    const primera = filas[0];
    if (!primera) throw noPublicado(periodo);
    const cuerpo: RespuestaIndicadores = {
      k: primera.k,
      periodo,
      datosSinteticos: DATOS_SINTETICOS,
      aviso: AVISO_INDICADORES,
      entes: filas.map((f) => {
        const { ente, motivo, denuncias, senal, tiempoPromedioDias, ...porcentajes } =
          f.detalle as IndicadoresEnte;
        return {
          ente,
          etiqueta: ETIQUETAS_ENTE.get(ente) ?? ente,
          motivo,
          denuncias,
          porcentajeConRespuesta: porcentajes.porcentajeConRespuesta,
          porcentajeTurnado: porcentajes.porcentajeTurnado,
          porcentajeArchivado: porcentajes.porcentajeArchivado,
          porcentajeSinCompetencia: porcentajes.porcentajeSinCompetencia,
          tiempoPromedioDias,
          senal,
        };
      }),
    };
    cachearPublico(res);
    res.json(cuerpo);
  });

  rutas.get("/metodologia", (_req, res) => {
    cachearPublico(res);
    res.json(metodologia(k, rezagoDias));
  });

  rutas.get("/pdn", (req, res) => {
    const estado = typeof req.query.estado === "string" ? req.query.estado : undefined;
    cachearPublico(res);
    res.json(pdn.resumen(estado));
  });

  rutas.get("/catalogos/municipios", (req, res) => {
    const estado = typeof req.query.estado === "string" ? req.query.estado : "";
    if (!/^\d{2}$/.test(estado)) throw new HttpError(400, "estado debe tener dos dígitos");
    cachearPublico(res);
    res.json({
      municipios: municipios(estado),
      fuente: "Catálogo del prototipo S5 de la PDN. Licencia pendiente de confirmar con SESNA.",
    });
  });

  rutas.get("/descargas/agregados.csv", async (req, res) => {
    const [periodo, filas] = await filasDelPeriodo(req.query.periodo);
    cachearPublico(res);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="agregados-${periodo}.csv"`);
    res.send(comoCsv(periodo, soloTablas(filas)));
  });

  rutas.get("/descargas/agregados.json", async (req, res) => {
    const [periodo, filas] = await filasDelPeriodo(req.query.periodo);
    cachearPublico(res);
    res.setHeader("Content-Disposition", `attachment; filename="agregados-${periodo}.json"`);
    res.json({
      periodo,
      datosSinteticos: DATOS_SINTETICOS,
      diccionario: DICCIONARIO_DATOS,
      filas: soloTablas(filas),
    });
  });

  rutas.get("/descargas/diccionario.json", (_req, res) => {
    cachearPublico(res);
    res.setHeader("Content-Disposition", 'attachment; filename="diccionario-de-datos.json"');
    res.json(DICCIONARIO_DATOS);
  });

  return rutas;
};
