import { createPrismaClient } from "@azul/database";
import { loadEnvFiles, readDatabaseUrl } from "../config/env.js";
import { executeBootstrap } from "./execute.js";

loadEnvFiles();

const code = await executeBootstrap(process.argv.slice(2), {
  openDatabase() {
    return createPrismaClient(readDatabaseUrl(process.env.DATABASE_URL));
  },
  stdout(message) {
    process.stdout.write(message);
  },
  stderr(message) {
    process.stderr.write(message);
  },
});

process.exitCode = code;
