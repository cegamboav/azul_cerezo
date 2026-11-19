import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../core/app-error.js";
import { MemoryAuthRepository } from "./memory-repository.js";
import { changePassword } from "./change-password.js";
import { authenticateLogin } from "./login.js";
import {
  INVALID_CREDENTIALS,
  PASSWORD_REUSED,
  PASSWORD_TOO_SHORT,
} from "./messages.js";
import {
  addCalendarMonths,
  clearDummyPasswordCache,
  dummyPasswordHash,
  hashPassword,
  isPasswordExpired,
  verifyPassword,
} from "./password.js";
import type { UserRecord } from "./types.js";

const rounds = 4;

async function user(password: string, overrides: Partial<UserRecord> = {}): Promise<UserRecord> {
  return {
    id: "user-1",
    email: "ana@example.com",
    passwordHash: await hashPassword(password, rounds),
    isActive: true,
    passwordChangedAt: new Date("2026-01-15T12:00:00.000Z"),
    mustChangePassword: false,
    memberships: [
      {
        id: "membership-1",
        companyId: "company-a",
        isActive: true,
        roleId: "role-1",
        roleKey: "OWNER",
        permissions: ["quotes.send"],
      },
    ],
    ...overrides,
  };
}

test("suma meses de calendario y usa el último día válido", () => {
  assert.equal(
    addCalendarMonths(new Date("2024-01-31T15:04:05.123Z"), 6).toISOString(),
    "2024-07-31T15:04:05.123Z",
  );
  assert.equal(
    addCalendarMonths(new Date("2024-03-31T00:00:00.000Z"), 6).toISOString(),
    "2024-09-30T00:00:00.000Z",
  );
  assert.equal(
    addCalendarMonths(new Date("2024-08-31T08:00:00.000Z"), 6).toISOString(),
    "2025-02-28T08:00:00.000Z",
  );
  assert.equal(
    addCalendarMonths(new Date("2023-08-31T08:00:00.000Z"), 6).toISOString(),
    "2024-02-29T08:00:00.000Z",
  );
});

test("el password expira al cumplirse seis meses calendario", () => {
  const changed = new Date("2024-01-31T00:00:00.000Z");
  const expires = addCalendarMonths(changed, 6);
  assert.equal(isPasswordExpired(changed, new Date(expires.getTime() - 1)), false);
  assert.equal(isPasswordExpired(changed, expires), true);
});

test("política de historial y cambio de password", async () => {
  const record = await user("password-zero");
  const repository = new MemoryAuthRepository([record]);
  const now = new Date("2026-03-01T00:00:00.000Z");
  let current = "password-zero";
  const previous: string[] = [];

  async function replace(next: string, at: Date): Promise<void> {
    await changePassword({
      userId: record.id,
      currentPassword: current,
      nextPassword: next,
      now: at,
      rounds,
      repository,
    });
    previous.push(current);
    current = next;
  }

  await assert.rejects(
    () =>
      changePassword({
        userId: record.id,
        currentPassword: current,
        nextPassword: "short",
        now,
        rounds,
        repository,
      }),
    (error: unknown) =>
      error instanceof AppError && error.message === PASSWORD_TOO_SHORT,
  );

  await replace("twelve-chars", new Date("2026-03-02T00:00:00.000Z"));
  const changed = await repository.findById(record.id);
  assert.ok(changed);
  assert.equal(changed.mustChangePassword, false);
  assert.equal(
    changed.passwordChangedAt.toISOString(),
    "2026-03-02T00:00:00.000Z",
  );
  assert.equal(repository.historyFor(record.id).length, 1);

  await assert.rejects(
    () =>
      changePassword({
        userId: record.id,
        currentPassword: "wrong-password",
        nextPassword: "another-valid",
        now,
        rounds,
        repository,
      }),
    (error: unknown) =>
      error instanceof AppError && error.message === INVALID_CREDENTIALS,
  );
  assert.equal(repository.historyFor(record.id).length, 1);

  await assert.rejects(
    () =>
      changePassword({
        userId: record.id,
        currentPassword: current,
        nextPassword: current,
        now,
        rounds,
        repository,
      }),
    (error: unknown) =>
      error instanceof AppError && error.message === PASSWORD_REUSED,
  );

  for (let index = 1; index <= 6; index += 1) {
    await replace(
      `password-${index}-ok`,
      new Date(Date.UTC(2026, 3, index)),
    );
  }

  for (const oldPassword of previous.slice(-6)) {
    await assert.rejects(
      () =>
        changePassword({
          userId: record.id,
          currentPassword: current,
          nextPassword: oldPassword,
          now,
          rounds,
          repository,
        }),
      (error: unknown) =>
        error instanceof AppError && error.message === PASSWORD_REUSED,
    );
  }

  const oldest = previous[0];
  assert.ok(oldest);
  await replace(oldest, new Date("2026-05-01T00:00:00.000Z"));
  assert.equal(repository.historyFor(record.id).length, 6);
});

test("dos cambios simultáneos no duplican el historial", async () => {
  const record = await user("starting-pass");
  const repository = new MemoryAuthRepository([record]);
  const results = await Promise.allSettled([
    changePassword({
      userId: record.id,
      currentPassword: "starting-pass",
      nextPassword: "changed-pass-1",
      now: new Date("2026-06-01T00:00:00.000Z"),
      rounds,
      repository,
    }),
    changePassword({
      userId: record.id,
      currentPassword: "starting-pass",
      nextPassword: "changed-pass-2",
      now: new Date("2026-06-01T00:00:01.000Z"),
      rounds,
      repository,
    }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(repository.historyFor(record.id).length, 1);
});

test("dos cambios que ya pasaron bcrypt no se sobrescriben", async () => {
  const record = await user("starting-pass");
  const repository = new MemoryAuthRepository([record]);
  let arrived = 0;
  let open = () => {};
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const beforeCommit = async () => {
    arrived += 1;
    if (arrived === 2) {
      open();
    }
    await gate;
  };
  const results = await Promise.allSettled([
    changePassword({
      userId: record.id,
      currentPassword: "starting-pass",
      nextPassword: "changed-pass-1",
      now: new Date("2026-06-01T00:00:00.000Z"),
      rounds,
      repository,
      beforeCommit,
    }),
    changePassword({
      userId: record.id,
      currentPassword: "starting-pass",
      nextPassword: "changed-pass-2",
      now: new Date("2026-06-01T00:00:01.000Z"),
      rounds,
      repository,
      beforeCommit,
    }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.equal(rejected?.status, "rejected");
  if (rejected?.status === "rejected") {
    assert.equal(rejected.reason instanceof AppError, true);
    assert.equal((rejected.reason as AppError).statusCode, 409);
  }
  assert.equal(repository.historyFor(record.id).length, 1);
  const saved = await repository.findById(record.id);
  assert.ok(saved);
  const first = await verifyPassword("changed-pass-1", saved.passwordHash);
  const second = await verifyPassword("changed-pass-2", saved.passwordHash);
  assert.equal(first === second, false);
});

test("un fallo al crear el hash ficticio no queda cacheado", async () => {
  const cost = 8;
  clearDummyPasswordCache(cost);
  await assert.rejects(
    () =>
      dummyPasswordHash(cost, async () => {
        throw new Error("temporal");
      }),
    /temporal/,
  );
  let generations = 0;
  const hash = await dummyPasswordHash(cost, async (value) => {
    generations += 1;
    return hashPassword("not-a-real-user-password", value);
  });
  const cached = await dummyPasswordHash(cost, async () => {
    generations += 1;
    throw new Error("no debería regenerarse");
  });
  assert.equal(generations, 1);
  assert.equal(cached, hash);
  assert.match(hash, /^\$2[aby]\$/);

  const record = await user("valid-password");
  const repository = new MemoryAuthRepository([record]);
  await assert.rejects(
    () =>
      authenticateLogin({
        email: "missing@example.com",
        password: "valid-password",
        now: new Date("2026-07-01T00:00:00.000Z"),
        secret: "h".repeat(32),
        rounds: cost,
        repository,
      }),
    (error: unknown) =>
      error instanceof AppError && error.message === INVALID_CREDENTIALS,
  );
});
