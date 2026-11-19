import { createPrismaClient } from "@azul/database";
import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { formatErrorForLog } from "./config/log-error.js";
import { logger } from "./config/logger.js";

const config = loadConfig();
const prisma = createPrismaClient(config.databaseUrl);
const app = createApp({ config, prisma });

const server = app.listen(config.port, () => {
  logger.info(`API escuchando en el puerto ${config.port}`);
});

function shutdown(signal: string): void {
  logger.info(`Cierre solicitado (${signal})`);
  server.close(() => {
    void prisma.$disconnect().finally(() => {
      process.exit(0);
    });
  });
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason) => {
  logger.error(formatErrorForLog("Promesa rechazada sin manejar", reason));
});

process.on("uncaughtException", (error) => {
  logger.error(formatErrorForLog("Excepción no capturada", error));
  process.exit(1);
});
