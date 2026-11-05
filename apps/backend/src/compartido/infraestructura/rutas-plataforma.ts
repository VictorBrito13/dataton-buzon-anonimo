import type { RespuestaConfiguracion } from "@dataton/shared";
import { Router } from "express";
import type { PowAltcha } from "./pow-altcha.js";

export const crearRutasPlataforma = (config: {
  configuracion: RespuestaConfiguracion;
  pow: PowAltcha;
}): Router => {
  const rutas = Router();
  rutas.get("/configuracion", (_req, res) => {
    res.json(config.configuracion);
  });
  rutas.get("/pow/reto", async (_req, res) => {
    res.json(await config.pow.crearReto());
  });
  return rutas;
};
