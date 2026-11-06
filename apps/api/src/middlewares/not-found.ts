import type { RequestHandler } from "express";
import { AppError } from "../modules/core/app-error.js";

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, "Recurso no encontrado."));
};
