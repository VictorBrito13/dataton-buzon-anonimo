import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../errors/http-error.js";
import { isProduction } from "../config/env.js";

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const status = error instanceof HttpError ? error.status : 500;
  const message =
    error instanceof HttpError ? error.message : "Internal server error";

  if (status >= 500) {
    console.error("[backend] unhandled error", error);
  }

  res.status(status).json({
    error: {
      message,
      ...(error instanceof HttpError && error.details !== undefined
        ? { details: error.details }
        : {}),
      ...(isProduction ? {} : { stack: error instanceof Error ? error.stack : undefined }),
    },
  });
};
