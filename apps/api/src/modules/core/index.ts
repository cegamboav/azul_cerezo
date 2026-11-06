import { Router } from "express";
import { healthRouter } from "./health.js";

export { AppError } from "./app-error.js";

export const coreRouter = Router();

coreRouter.use(healthRouter);
