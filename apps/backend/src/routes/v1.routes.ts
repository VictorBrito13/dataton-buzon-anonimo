import express, { Router } from "express";
import { crearRutasPlataforma } from "../compartido/infraestructura/rutas-plataforma.js";
import {
  casos,
  configuracionPublica,
  cookieSegura,
  pow,
  semaforoLimpiezas,
} from "../composicion.js";
import { env } from "../config/env.js";
import {
  crearRutasAcceso,
  crearRutasDenuncias,
} from "../contextos/denuncias/infraestructura/rutas.js";
import { crearRutasEvidencias } from "../contextos/evidencias/infraestructura/rutas.js";
import { crearRutasAutoridad } from "../contextos/tramite/infraestructura/rutas.js";

/** Alcanza para el relato sellado (200 KB en base64url) más el resto de los campos. */
const LIMITE_JSON = "256kb";

export const v1Router: Router = Router();

v1Router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Estas dos rutas leen el cuerpo a su manera: van antes del lector de JSON general.
v1Router.use(
  "/evidencias",
  crearRutasEvidencias({
    recibir: casos.recibirEvidencia,
    pow,
    maxBytes: env.maxBytesEvidencia,
    semaforo: semaforoLimpiezas,
  }),
);
v1Router.use(
  "/acceso",
  crearRutasAcceso({
    consultar: casos.consultar,
    enviarMensaje: casos.enviarMensaje,
    tiempoMinimoMs: env.accesoTiempoMinimoMs,
    limiteJson: LIMITE_JSON,
  }),
);

v1Router.use(express.json({ limit: LIMITE_JSON }));

v1Router.use(crearRutasPlataforma({ configuracion: configuracionPublica, pow }));
v1Router.use("/denuncias", crearRutasDenuncias({ crear: casos.crearDenuncia }));
v1Router.use(
  "/autoridad",
  crearRutasAutoridad({
    sesion: casos.sesion,
    denuncias: casos.denunciasAutoridad,
    duracionMs: env.sesionDuracionMs,
    cookieSegura,
  }),
);
