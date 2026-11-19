import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { PrismaClient } from "@azul/database";
import type { AppConfig } from "./config/env.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { notFoundHandler } from "./middlewares/not-found.js";
import { createRateLimiter, rateLimit } from "./middlewares/rate-limit.js";
import { requestLogger } from "./middlewares/request-logger.js";
import { BCRYPT_ROUNDS } from "./modules/auth/password.js";
import { PrismaAuthRepository } from "./modules/auth/prisma-repository.js";
import { createAuthRouter } from "./modules/auth/routes.js";
import type { AuthRepository } from "./modules/auth/types.js";
import { coreRouter } from "./modules/core/index.js";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export interface AppDependencies {
  config: AppConfig;
  prisma: PrismaClient;
  authRepository?: AuthRepository;
  bcryptRounds?: number;
  now?: () => Date;
  mount?: (app: express.Express) => void;
}

export function createApp(dependencies: AppDependencies): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.locals.prisma = dependencies.prisma;

  const repository =
    dependencies.authRepository ?? new PrismaAuthRepository(dependencies.prisma);
  const rounds = dependencies.bcryptRounds ?? BCRYPT_ROUNDS;
  const attempts = createRateLimiter({ limit: 5, windowMs: FIFTEEN_MINUTES_MS });

  app.use(helmet());
  app.use(requestLogger);
  app.use(cors({ origin: dependencies.config.corsOrigin }));
  app.use(express.json({ limit: "1mb" }));
  app.use(
    createAuthRouter({
      secret: dependencies.config.jwtSecret,
      rounds,
      repository,
      loginLimit: rateLimit("login", attempts),
      changeLimit: rateLimit("change-password", attempts),
      now: dependencies.now,
    }),
  );
  app.use(coreRouter);
  dependencies.mount?.(app);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
