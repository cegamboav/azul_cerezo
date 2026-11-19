import type { ErrorRequestHandler } from "express";
import { formatErrorForLog } from "../config/log-error.js";
import { logger } from "../config/logger.js";
import { AppError } from "../modules/core/app-error.js";

const GENERIC_MESSAGE = "No se pudo completar la solicitud.";

function isInvalidJson(err: unknown): boolean {
  if (!(err instanceof SyntaxError)) {
    return false;
  }
  return "status" in err && err.status === 400;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) {
    return;
  }

  if (isInvalidJson(err)) {
    res.status(400).json({
      error: { message: "El cuerpo de la solicitud no es JSON válido." },
    });
    return;
  }

  if (err instanceof AppError && err.statusCode < 500) {
    res.status(err.statusCode).json({ error: { message: err.message } });
    return;
  }

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  logger.error(formatErrorForLog(`${req.method} ${req.path}`, err));
  res.status(statusCode).json({ error: { message: GENERIC_MESSAGE } });
};
