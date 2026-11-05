import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import { apiRouter } from "./routes/index.js";

/**
 * Sin registro de peticiones a propósito: nada aquí lee ni guarda IP, user-agent ni cuerpos.
 * Cada grupo de rutas lee el cuerpo con el límite que le corresponde (ver routes/v1.routes.ts).
 */
export const createApp = (): Express => {
  const app = express();

  app.disable("x-powered-by");
  app.disable("etag");
  app.set("trust proxy", false);

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: false }));

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
