import {
  solicitudCambioEtapa,
  solicitudMensajeAutoridad,
  solicitudSesionAutoridad,
} from "@dataton/shared";
import { Router, type Request, type RequestHandler, type Response } from "express";
import { z } from "zod";
import { validar } from "../../../compartido/infraestructura/http.js";
import { HttpError } from "../../../errors/http-error.js";
import type { CasosDenunciasAutoridad } from "../aplicacion/casos-denuncias.js";
import type { CasosSesion } from "../aplicacion/casos-sesion.js";
import type { Sesion } from "../dominio/sesion.js";

const COOKIE = "sesion_autoridad";
const RUTA_COOKIE = "/api/v1/autoridad";

const tokenDe = (req: Request): string | null => {
  for (const parte of (req.headers.cookie ?? "").split(";")) {
    const [nombre, valor] = parte.trim().split("=");
    if (nombre === COOKIE && valor) return valor;
  }
  return null;
};

const uuid = z.uuid();

/** Un identificador mal formado se trata como inexistente, sin llegar a la base de datos. */
const idDe = (req: Request, nombre: string, recurso: string): string => {
  const id = uuid.safeParse(req.params[nombre]);
  if (!id.success) throw new HttpError(404, `${recurso} no existe.`);
  return id.data;
};

const sesionDe = (res: Response): Sesion => (res.locals as { sesion: Sesion }).sesion;

export const crearRutasAutoridad = (config: {
  sesion: CasosSesion;
  denuncias: CasosDenunciasAutoridad;
  duracionMs: number;
  cookieSegura: boolean;
}): Router => {
  const { sesion, denuncias, duracionMs, cookieSegura } = config;
  const atributos = {
    httpOnly: true,
    sameSite: "strict",
    secure: cookieSegura,
    path: RUTA_COOKIE,
  } as const;
  const rutas = Router();

  rutas.post("/sesion", async (req, res) => {
    const { usuario, contrasena } = validar(solicitudSesionAutoridad, req.body);
    const inicio = await sesion.iniciar(usuario, contrasena);
    res.cookie(COOKIE, inicio.token, { ...atributos, maxAge: duracionMs });
    res.json({ usuario: inicio.usuario });
  });

  const exigirSesion: RequestHandler = (req, res, next) => {
    const token = tokenDe(req);
    const actual = token ? sesion.actual(token) : null;
    if (!actual) throw new HttpError(401, "Inicia sesión para continuar.");
    (res.locals as { sesion: Sesion }).sesion = actual;
    next();
  };
  rutas.use(exigirSesion);

  rutas.get("/sesion", (_req, res) => {
    res.json({ usuario: sesionDe(res).usuario });
  });

  rutas.delete("/sesion", async (req, res) => {
    await sesion.cerrar(tokenDe(req) as string);
    res.clearCookie(COOKIE, atributos);
    res.status(204).end();
  });

  rutas.get("/denuncias", async (_req, res) => {
    res.json(await denuncias.listar(sesionDe(res)));
  });

  rutas.get("/denuncias/:id", async (req, res) => {
    res.json(await denuncias.ver(sesionDe(res), idDe(req, "id", "La denuncia")));
  });

  rutas.post("/denuncias/:id/etapa", async (req, res) => {
    const id = idDe(req, "id", "La denuncia");
    const { etapa } = validar(solicitudCambioEtapa, req.body);
    await denuncias.cambiarEtapa(sesionDe(res), id, etapa);
    res.json({ etapa });
  });

  rutas.post("/denuncias/:id/mensajes", async (req, res) => {
    const id = idDe(req, "id", "La denuncia");
    const { cuerpo } = validar(solicitudMensajeAutoridad, req.body);
    await denuncias.enviarMensaje(sesionDe(res), id, cuerpo);
    res.status(201).json({ ok: true });
  });

  rutas.get("/denuncias/:id/evidencias/:eid", async (req, res) => {
    const evidencia = await denuncias.descargarEvidencia(
      sesionDe(res),
      idDe(req, "id", "La denuncia"),
      idDe(req, "eid", "La evidencia"),
    );
    res
      .set({
        "Content-Type": "application/octet-stream",
        "Content-Disposition": "attachment",
        "X-Evidencia-Tipo": evidencia.tipo,
      })
      .end(Buffer.from(evidencia.blobSellado));
  });

  return rutas;
};
