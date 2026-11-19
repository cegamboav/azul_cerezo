import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { AppError } from "../core/app-error.js";
import { signToken, verifyToken } from "./jwt.js";
import { SESSION_EXPIRED, TOKEN_TTL_SECONDS, UNAUTHORIZED } from "./messages.js";

const secret = "e".repeat(32);

const claims = {
  userId: "user-1",
  companyId: "company-a",
  passwordChangedAt: "2026-01-15T12:00:00.000Z",
  purpose: "access" as const,
};

test("firma un JWT de acceso de 60 minutos y lo verifica", () => {
  const token = signToken(claims, secret);
  const decoded = jwt.decode(token);
  assert.equal(typeof decoded === "object" && decoded !== null, true);
  if (typeof decoded !== "object" || decoded === null) {
    return;
  }
  assert.equal("exp" in decoded && "iat" in decoded, true);
  const payload = decoded as { iat: number; exp: number };
  assert.equal(payload.exp - payload.iat, TOKEN_TTL_SECONDS);
  assert.deepEqual(verifyToken(token, secret), claims);
  assert.equal(token.includes("ana@example.com"), false);
});

test("rechaza firma inválida y token expirado", () => {
  const token = signToken(claims, secret);
  assert.throws(
    () => verifyToken(`${token}x`, secret),
    (error: unknown) => error instanceof AppError && error.message === UNAUTHORIZED,
  );
  const expired = jwt.sign(
    { ...claims, exp: Math.floor(Date.now() / 1000) - 10 },
    secret,
    { algorithm: "HS256" },
  );
  assert.throws(
    () => verifyToken(expired, secret),
    (error: unknown) =>
      error instanceof AppError && error.message === SESSION_EXPIRED,
  );
});

test("acepta purpose password_change y conserva sus claims", () => {
  const token = signToken({ ...claims, purpose: "password_change" }, secret);
  assert.equal(verifyToken(token, secret).purpose, "password_change");
});
