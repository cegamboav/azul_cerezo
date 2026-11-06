import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigin: string;
  databaseUrl: string;
}

const sourceDir = path.dirname(fileURLToPath(import.meta.url));

function findRepoEnv(startDir: string): string | undefined {
  let current = path.resolve(startDir);
  const seen = new Set<string>();
  while (!seen.has(current)) {
    seen.add(current);
    if (existsSync(path.join(current, "prisma.config.ts"))) {
      const envFile = path.join(current, ".env");
      return existsSync(envFile) ? envFile : undefined;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
  return undefined;
}

function loadEnvFiles(): void {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    findRepoEnv(sourceDir),
  ].filter((file): file is string => file !== undefined && existsSync(file));
  const unique = [...new Set(candidates)];
  if (unique.length === 0) {
    return;
  }
  loadDotenv({ path: unique, quiet: true });
}

function readPort(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") {
    return 3001;
  }
  if (!/^\d+$/.test(raw.trim())) {
    throw new Error("PORT no es un número válido.");
  }
  const port = Number(raw.trim());
  if (port < 1 || port > 65535) {
    throw new Error("PORT está fuera de rango.");
  }
  return port;
}

function readDatabaseUrl(raw: string | undefined): string {
  const databaseUrl = raw?.trim() ?? "";
  if (databaseUrl === "") {
    throw new Error("Falta DATABASE_URL.");
  }
  if (
    !databaseUrl.startsWith("postgresql://") &&
    !databaseUrl.startsWith("postgres://")
  ) {
    throw new Error("DATABASE_URL debe usar PostgreSQL.");
  }
  return databaseUrl;
}

function readCorsOrigin(raw: string | undefined): string {
  const origin = raw?.trim() || "http://localhost:5173";
  if (origin === "*") {
    throw new Error("CORS_ORIGIN debe ser un origen concreto.");
  }
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error("CORS_ORIGIN no es una URL válida.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("CORS_ORIGIN debe usar http o https.");
  }
  return origin;
}

export function loadConfig(): AppConfig {
  loadEnvFiles();
  return {
    nodeEnv: process.env.NODE_ENV?.trim() || "development",
    port: readPort(process.env.PORT),
    corsOrigin: readCorsOrigin(process.env.CORS_ORIGIN),
    databaseUrl: readDatabaseUrl(process.env.DATABASE_URL),
  };
}
