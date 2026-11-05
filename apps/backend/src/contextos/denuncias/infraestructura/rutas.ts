import {
  ERROR_ACCESO,
  solicitudConsulta,
  solicitudDenuncia,
  solicitudMensajeDenunciante,
} from "@dataton/shared";
import express, { Router, type RequestHandler } from "express";
import { validar } from "../../../compartido/infraestructura/http.js";
import { registrarError } from "../../../compartido/infraestructura/registro.js";
import type { ConsultarDenuncia } from "../aplicacion/consultar-denuncia.js";
import type { CrearDenuncia } from "../aplicacion/crear-denuncia.js";
import type { EnviarMensajeDenunciante } from "../aplicacion/enviar-mensaje-denunciante.js";

const deBase64Url = (texto: string): Uint8Array => new Uint8Array(Buffer.from(texto, "base64url"));

export const crearRutasDenuncias = (casos: { crear: CrearDenuncia }): Router => {
  const rutas = Router();
  rutas.post("/", async (req, res) => {
    const { relatoSellado, ...datos } = validar(solicitudDenuncia, req.body);
    const { folio } = await casos.crear.ejecutar({
      ...datos,
      relatoSellado: deBase64Url(relatoSellado),
    });
    res.status(201).json({ folio });
  });
  return rutas;
};

/** Toda salida: la misma tras cualquier fallo, y nunca antes del tiempo mínimo. */
const conRespuestaUniforme =
  (
    tiempoMinimoMs: number,
    operacion: (cuerpo: unknown) => Promise<{ estado: number; cuerpo: unknown } | null>,
  ): RequestHandler =>
  async (req, res) => {
    const inicio = performance.now();
    let salida: { estado: number; cuerpo: unknown } | null = null;
    try {
      salida = await operacion(req.body);
    } catch (error) {
      registrarError("acceso", error);
    }
    const restante = tiempoMinimoMs - (performance.now() - inicio);
    if (restante > 0) await new Promise((resolver) => setTimeout(resolver, restante));
    if (salida) res.status(salida.estado).json(salida.cuerpo);
    else res.status(401).json(ERROR_ACCESO);
  };

export const crearRutasAcceso = (config: {
  consultar: ConsultarDenuncia;
  enviarMensaje: EnviarMensajeDenunciante;
  tiempoMinimoMs: number;
  limiteJson: string;
}): Router => {
  const rutas = Router();

  // Un JSON roto o demasiado grande tampoco debe distinguirse de una credencial inexistente.
  const leerJson = express.json({ limit: config.limiteJson });
  rutas.use((req, res, next) => {
    leerJson(req, res, (error: unknown) => {
      if (error) req.body = undefined;
      next();
    });
  });

  rutas.post(
    "/consulta",
    conRespuestaUniforme(config.tiempoMinimoMs, async (cuerpo) => {
      const solicitud = solicitudConsulta.safeParse(cuerpo);
      if (!solicitud.success) return null;
      const { pow, credencial } = solicitud.data;
      const respuesta = await config.consultar.ejecutar(pow, credencial);
      return respuesta && { estado: 200, cuerpo: respuesta };
    }),
  );

  rutas.post(
    "/mensajes",
    conRespuestaUniforme(config.tiempoMinimoMs, async (cuerpo) => {
      const solicitud = solicitudMensajeDenunciante.safeParse(cuerpo);
      if (!solicitud.success) return null;
      const { pow, credencial, cuerpoSellado } = solicitud.data;
      const guardado = await config.enviarMensaje.ejecutar(
        pow,
        credencial,
        deBase64Url(cuerpoSellado),
      );
      return guardado ? { estado: 201, cuerpo: { ok: true } } : null;
    }),
  );

  return rutas;
};
