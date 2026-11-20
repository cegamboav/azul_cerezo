import assert from "node:assert/strict";
import test from "node:test";
import { PERMISSIONS, ROLE_KEYS, ROLE_NAMES, ROLE_PERMISSIONS } from "./permissions.js";

test("el catálogo y la matriz aprobados quedan en código", () => {
  assert.equal(PERMISSIONS.length, 14);
  assert.ok(PERMISSIONS.includes("quotes.send"));
  assert.ok(PERMISSIONS.includes("users.manage"));
  assert.deepEqual(ROLE_PERMISSIONS.OWNER, PERMISSIONS);
  assert.equal(ROLE_PERMISSIONS.ADMIN.includes("settings.manage"), false);
  assert.equal(ROLE_PERMISSIONS.ADMIN.includes("quotes.send"), true);
  assert.equal(ROLE_PERMISSIONS.COORDINATOR.includes("quotes.send"), false);
  assert.equal(ROLE_PERMISSIONS.COORDINATOR.includes("visits.execute"), false);
  assert.equal(ROLE_PERMISSIONS.COORDINATOR.includes("billing.write"), false);
  assert.equal(ROLE_PERMISSIONS.COORDINATOR.includes("users.manage"), false);
  assert.deepEqual(ROLE_PERMISSIONS.WORKER, []);
  assert.deepEqual(ROLE_PERMISSIONS.CLIENT, []);
  for (const key of ROLE_KEYS) {
    assert.equal(ROLE_NAMES[key].length > 0, true);
  }
});
