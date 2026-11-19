import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword } from "../modules/auth/password.js";
import { formatErrorForLog } from "./log-error.js";

test("el log de un error 500 no incluye hash, password ni token", async () => {
  const passwordHash = await hashPassword("valid-password", 4);
  const token = `eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signaturevalue`;
  const failure = new Error(
    `update failed passwordHash=${passwordHash} Bearer ${token} password=valid-password`,
  );
  Object.assign(failure, {
    passwordHash,
    meta: { authorization: `Bearer ${token}` },
  });
  const text = formatErrorForLog("POST /auth/change-password", failure);
  assert.equal(text.includes(passwordHash), false);
  assert.equal(text.includes("valid-password"), false);
  assert.equal(text.includes(token), false);
  assert.match(text, /POST \/auth\/change-password Error: update failed/);
  assert.match(text, /\[redacted\]/);
});
