import { Router } from "express";
import { publicoRouter } from "../contextos/transparencia/infraestructura/montaje.js";
import { healthRouter } from "./health.routes.js";

export const apiRouter: Router = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/v1/publico", publicoRouter);
