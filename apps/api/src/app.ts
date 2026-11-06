import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { PrismaClient } from "@azul/database";
import type { AppConfig } from "./config/env.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { notFoundHandler } from "./middlewares/not-found.js";
import { requestLogger } from "./middlewares/request-logger.js";
import { coreRouter } from "./modules/core/index.js";

export interface AppDependencies {
  config: AppConfig;
  prisma: PrismaClient;
}

export function createApp(dependencies: AppDependencies): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.locals.prisma = dependencies.prisma;

  app.use(helmet());
  app.use(requestLogger);
  app.use(cors({ origin: dependencies.config.corsOrigin }));
  app.use(express.json({ limit: "1mb" }));
  app.use(coreRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
