import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loadConfig, readJwtSecret } from "./env.js";

describe("configuración", { concurrency: false }, () => {
test("JWT_SECRET ausente o corto impide arrancar", () => {
  assert.throws(() => readJwtSecret(undefined), /Falta JWT_SECRET/);
  assert.throws(() => readJwtSecret("   "), /Falta JWT_SECRET/);
  assert.throws(() => readJwtSecret("a".repeat(31)), /32 bytes/);
});

test("loadConfig rechaza un JWT_SECRET corto en cualquier entorno", () => {
  process.env.NODE_ENV = "development";
  process.env.PORT = "3001";
  process.env.CORS_ORIGIN = "http://localhost:5173";
  process.env.DATABASE_URL = "postgresql://user:secret@127.0.0.1:5432/azul_cerezo";
  process.env.JWT_SECRET = "corto";
  assert.throws(() => loadConfig(), /32 bytes/);
});

test("32 bytes repetidos cumplen la longitud y no miden entropía", () => {
  const secret = "a".repeat(32);
  assert.equal(Buffer.byteLength(secret, "utf8"), 32);
  assert.equal(readJwtSecret(secret), secret);
});

test("loadConfig acepta un JWT_SECRET de al menos 32 bytes", () => {
  process.env.NODE_ENV = "production";
  process.env.PORT = "3001";
  process.env.CORS_ORIGIN = "http://localhost:5173";
  process.env.DATABASE_URL = "postgresql://user:secret@127.0.0.1:5432/azul_cerezo";
  process.env.JWT_SECRET = "b".repeat(32);
  assert.equal(loadConfig().jwtSecret, "b".repeat(32));
});
});
