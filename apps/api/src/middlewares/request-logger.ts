import type { RequestHandler } from "express";
import { logger } from "../config/logger.js";

export const requestLogger: RequestHandler = (req, res, next) => {
  const started = process.hrtime.bigint();
  res.on("finish", () => {
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    logger.info(
      `${req.method} ${req.path} ${res.statusCode} ${elapsedMs.toFixed(0)}ms`,
    );
  });
  next();
};
