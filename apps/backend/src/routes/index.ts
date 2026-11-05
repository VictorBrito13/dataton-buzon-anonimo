import { Router } from "express";
import { publicoRouter } from "../contextos/transparencia/infraestructura/montaje.js";
import { healthRouter } from "./health.routes.js";
import { v1Router } from "./v1.routes.js";

export const apiRouter: Router = Router();

apiRouter.use("/health", healthRouter);
// La API pública va antes: usa su propia conexión de solo lectura y no pasa por el resto de v1.
apiRouter.use("/v1/publico", publicoRouter);
apiRouter.use("/v1", v1Router);
