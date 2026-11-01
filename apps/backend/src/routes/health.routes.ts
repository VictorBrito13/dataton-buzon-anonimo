import { Router } from "express";
import { checkDatabase } from "../db/postgres.js";
import { HttpError } from "../errors/http-error.js";

export const healthRouter: Router = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get("/db", async (_req, res) => {
  try {
    await checkDatabase();
    res.json({ status: "ok", database: "up" });
  } catch {
    throw new HttpError(503, "Database unavailable");
  }
});
