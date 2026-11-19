import assert from "node:assert/strict";
import test from "node:test";
import type { Server } from "node:http";
import type { PrismaClient } from "@azul/database";
import { createApp } from "../../app.js";
import type { AppConfig } from "../../config/env.js";
import { requireAuth } from "../../middlewares/require-auth.js";
import { requirePasswordChange } from "../../middlewares/require-password-change.js";
import { requirePermission } from "../../middlewares/require-permission.js";
import { hashPassword, verifyPassword } from "./password.js";
import { MemoryAuthRepository } from "./memory-repository.js";
import { authenticateLogin } from "./login.js";
import { signToken } from "./jwt.js";
import {
  INVALID_CREDENTIALS,
  PASSWORD_CHANGE_REQUIRED,
  RATE_LIMITED,
  UNAUTHORIZED,
} from "./messages.js";
import type { UserRecord } from "./types.js";

const rounds = 4;
const secret = "f".repeat(32);

function config(): AppConfig {
  return {
    nodeEnv: "test",
    port: 0,
    corsOrigin: "http://localhost:5173",
    databaseUrl: "postgresql://user:secret@127.0.0.1:5432/azul_cerezo",
    jwtSecret: secret,
  };
}

async function account(
  overrides: Partial<UserRecord> & { password: string },
): Promise<UserRecord> {
  const { password, ...rest } = overrides;
  return {
    id: rest.id ?? "user-1",
    email: rest.email ?? "ana@example.com",
    passwordHash: await hashPassword(password, rounds),
    isActive: rest.isActive ?? true,
    passwordChangedAt: rest.passwordChangedAt ?? new Date("2026-06-01T00:00:00.000Z"),
    mustChangePassword: rest.mustChangePassword ?? false,
    memberships: rest.memberships ?? [
      {
        id: "membership-1",
        companyId: "company-a",
        isActive: true,
        roleId: "role-1",
        roleKey: "COORDINATOR",
        permissions: ["quotes.read"],
      },
    ],
  };
}

const fixedNow = new Date("2026-07-01T00:00:00.000Z");

async function listen(repository: MemoryAuthRepository, usersNow = fixedNow) {
  const app = createApp({
    config: config(),
    prisma: {} as PrismaClient,
    authRepository: repository,
    bcryptRounds: rounds,
    now: () => usersNow,
    mount(application) {
      const guard = requireAuth({
        secret,
        repository,
        now: () => usersNow,
      });
      application.get("/api/core/probe", guard, (req, res) => {
        res.status(200).json({ companyId: req.auth?.companyId });
      });
      application.post("/api/core/probe", guard, (req, res) => {
        res.status(200).json({
          companyId: req.auth?.companyId,
          bodyCompanyId:
            typeof req.body === "object" && req.body !== null
              ? (req.body as { companyId?: unknown }).companyId
              : undefined,
        });
      });
      application.post(
        "/auth/password-session",
        requirePasswordChange({ secret, repository }),
        (req, res) => {
          res.status(200).json({
            purpose: req.auth?.purpose,
            permissions: req.auth?.permissions ?? [],
          });
        },
      );
      application.post(
        "/api/core/send",
        guard,
        requirePermission("quotes.send"),
        (_req, res) => {
          res.status(200).json({ sent: true });
        },
      );
    },
  });
  const server = await new Promise<Server>((resolve) => {
    const started = app.listen(0, "127.0.0.1", () => resolve(started));
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    base: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function post(
  base: string,
  path: string,
  body: unknown,
  token?: string,
  headers: Record<string, string> = {},
) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

test("login válido, rechazos genéricos y estados de password", async () => {
  const active = await account({ password: "valid-password" });
  const inactive = await account({
    id: "user-inactive",
    email: "inactive@example.com",
    password: "valid-password",
    isActive: false,
  });
  const paused = await account({
    id: "user-paused",
    email: "paused@example.com",
    password: "valid-password",
    memberships: [
      {
        id: "membership-paused",
        companyId: "company-a",
        isActive: false,
        roleId: "role-1",
        roleKey: "OWNER",
        permissions: ["quotes.send"],
      },
    ],
  });
  const none = await account({
    id: "user-none",
    email: "none@example.com",
    password: "valid-password",
    memberships: [],
  });
  const many = await account({
    id: "user-many",
    email: "many@example.com",
    password: "valid-password",
    memberships: [
      {
        id: "membership-a",
        companyId: "company-a",
        isActive: true,
        roleId: "role-a",
        roleKey: "OWNER",
        permissions: ["quotes.send"],
      },
      {
        id: "membership-b",
        companyId: "company-b",
        isActive: true,
        roleId: "role-b",
        roleKey: "ADMIN",
        permissions: ["quotes.send"],
      },
    ],
  });
  const expired = await account({
    id: "user-expired",
    email: "expired@example.com",
    password: "valid-password",
    passwordChangedAt: new Date("2020-01-01T00:00:00.000Z"),
  });
  const temporary = await account({
    id: "user-temporary",
    email: "temporary@example.com",
    password: "valid-password",
    mustChangePassword: true,
  });
  const repository = new MemoryAuthRepository([
    active,
    inactive,
    paused,
    none,
    many,
    expired,
    temporary,
  ]);
  const generic = await listen(repository);
  let genericBody: Record<string, unknown> | undefined;
  try {
    const ok = await post(generic.base, "/auth/login", {
      email: active.email,
      password: "valid-password",
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.purpose, "access");
    assert.equal(typeof ok.body.token, "string");

    const missing = await post(generic.base, "/auth/login", {
      email: "missing@example.com",
      password: "valid-password",
    });
    const wrong = await post(generic.base, "/auth/login", {
      email: active.email,
      password: "other-password",
    });
    assert.equal(missing.status, 401);
    assert.deepEqual(missing.body, wrong.body);
    assert.deepEqual(missing.body, {
      error: { message: INVALID_CREDENTIALS },
    });
    assert.equal(JSON.stringify(missing.body).includes("valid-password"), false);
    genericBody = missing.body;
  } finally {
    await generic.close();
  }

  const rejectedServer = await listen(repository);
  try {
    for (const email of [inactive.email, paused.email, none.email, many.email]) {
      const rejected = await post(rejectedServer.base, "/auth/login", {
        email,
        password: "valid-password",
      });
      assert.deepEqual(rejected.body, genericBody);
    }
  } finally {
    await rejectedServer.close();
  }

  const expiredServer = await listen(repository);
  try {
    const expiredLogin = await post(expiredServer.base, "/auth/login", {
      email: expired.email,
      password: "valid-password",
    });
    assert.equal(expiredLogin.status, 200);
    assert.equal(expiredLogin.body.purpose, "password_change");

    const temporaryLogin = await post(expiredServer.base, "/auth/login", {
      email: temporary.email,
      password: "valid-password",
    });
    assert.equal(temporaryLogin.body.purpose, "password_change");

    const probe = await fetch(`${expiredServer.base}/api/core/probe`, {
      headers: { authorization: `Bearer ${String(expiredLogin.body.token)}` },
    });
    assert.equal(probe.status, 403);
    assert.deepEqual(await probe.json(), { error: { message: UNAUTHORIZED } });

    const restricted = await post(
      expiredServer.base,
      "/auth/password-session",
      {},
      String(expiredLogin.body.token),
    );
    assert.equal(restricted.status, 200);
    assert.equal(restricted.body.purpose, "password_change");
    assert.deepEqual(restricted.body.permissions, []);

    const changed = await post(
      expiredServer.base,
      "/auth/change-password",
      { currentPassword: "valid-password", nextPassword: "replacement-1" },
      String(expiredLogin.body.token),
    );
    assert.equal(changed.status, 200);
    assert.deepEqual(changed.body, { changed: true });
    assert.equal(JSON.stringify(changed.body).includes("replacement-1"), false);

    const reused = await post(
      expiredServer.base,
      "/auth/change-password",
      { currentPassword: "valid-password", nextPassword: "replacement-2" },
      String(expiredLogin.body.token),
    );
    assert.equal(reused.status, 401);

    const renewed = await post(expiredServer.base, "/auth/login", {
      email: expired.email,
      password: "replacement-1",
    });
    assert.equal(renewed.status, 200);
    assert.equal(renewed.body.purpose, "access");
  } finally {
    await expiredServer.close();
  }
});

test("el email inexistente también ejecuta bcrypt", async () => {
  const record = await account({ password: "valid-password" });
  const repository = new MemoryAuthRepository([record]);
  let comparisons = 0;
  const verify = async (plain: string, passwordHash: string) => {
    comparisons += 1;
    return verifyPassword(plain, passwordHash);
  };
  await assert.rejects(() =>
    authenticateLogin({
      email: "missing@example.com",
      password: "valid-password",
      now: new Date("2026-07-01T00:00:00.000Z"),
      secret,
      rounds,
      repository,
      verify,
    }),
  );
  const afterMissing = comparisons;
  await assert.rejects(() =>
    authenticateLogin({
      email: record.email,
      password: "other-password",
      now: new Date("2026-07-01T00:00:00.000Z"),
      secret,
      rounds,
      repository,
      verify,
    }),
  );
  assert.equal(afterMissing, 1);
  assert.equal(comparisons, 2);
});

test("el rate limit de login no confía en X-Forwarded-For", async () => {
  const record = await account({ password: "valid-password" });
  const repository = new MemoryAuthRepository([record]);
  const server = await listen(repository);
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await post(
        server.base,
        "/auth/login",
        { email: record.email, password: "other-password" },
        undefined,
        { "x-forwarded-for": `10.0.0.${attempt}` },
      );
      assert.equal(response.status, 401);
    }
    const blocked = await post(
      server.base,
      "/auth/login",
      { email: record.email, password: "other-password" },
      undefined,
      { "x-forwarded-for": "10.9.9.9" },
    );
    assert.equal(blocked.status, 429);
    assert.deepEqual(blocked.body, { error: { message: RATE_LIMITED } });
  } finally {
    await server.close();
  }
});

test("el companyId del token manda y el token de otra empresa se rechaza", async () => {
  const record = await account({
    password: "valid-password",
    memberships: [
      {
        id: "membership-1",
        companyId: "company-a",
        isActive: true,
        roleId: "role-1",
        roleKey: "OWNER",
        permissions: ["quotes.read"],
      },
    ],
  });
  const repository = new MemoryAuthRepository([record]);
  const server = await listen(repository);
  try {
    const login = await post(server.base, "/auth/login", {
      email: record.email,
      password: "valid-password",
    });
    const token = String(login.body.token);
    const probe = await post(
      server.base,
      "/api/core/probe",
      { companyId: "company-b" },
      token,
    );
    assert.equal(probe.status, 200);
    assert.equal(probe.body.companyId, "company-a");
    assert.equal(probe.body.bodyCompanyId, "company-b");

    const foreign = signToken(
      {
        userId: record.id,
        companyId: "company-b",
        passwordChangedAt: record.passwordChangedAt.toISOString(),
        purpose: "access",
      },
      secret,
    );
    const rejected = await fetch(`${server.base}/api/core/probe`, {
      headers: { authorization: `Bearer ${foreign}` },
    });
    assert.equal(rejected.status, 401);

    const strict = await post(server.base, "/auth/password-session", {}, token);
    assert.equal(strict.status, 401);

    const forbidden = await post(server.base, "/api/core/send", {}, token);
    assert.equal(forbidden.status, 403);
    assert.deepEqual(forbidden.body, { error: { message: UNAUTHORIZED } });

    const missingCurrent = await post(
      server.base,
      "/auth/change-password",
      { nextPassword: "replacement-1" },
      token,
    );
    assert.equal(missingCurrent.status, 400);

    const changed = await post(
      server.base,
      "/auth/change-password",
      { currentPassword: "valid-password", nextPassword: "replacement-1" },
      token,
    );
    assert.equal(changed.status, 200);

    const stale = await fetch(`${server.base}/api/core/probe`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(stale.status, 401);
  } finally {
    await server.close();
  }
});

test("un access token con password vencido no entra a negocio", async () => {
  const record = await account({
    password: "valid-password",
    passwordChangedAt: new Date("2020-01-01T00:00:00.000Z"),
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
  });
  const repository = new MemoryAuthRepository([record]);
  const server = await listen(repository, new Date("2026-08-01T00:00:00.000Z"));
  try {
    const token = signToken(
      {
        userId: record.id,
        companyId: "company-a",
        passwordChangedAt: record.passwordChangedAt.toISOString(),
        purpose: "access",
      },
      secret,
    );
    const probe = await fetch(`${server.base}/api/core/probe`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(probe.status, 403);
    assert.deepEqual(await probe.json(), {
      error: { message: PASSWORD_CHANGE_REQUIRED },
    });
  } finally {
    await server.close();
  }
});

test("un access token con mustChangePassword no entra a negocio", async () => {
  const record = await account({
    password: "valid-password",
    mustChangePassword: true,
  });
  const repository = new MemoryAuthRepository([record]);
  const server = await listen(repository);
  try {
    const token = signToken(
      {
        userId: record.id,
        companyId: "company-a",
        passwordChangedAt: record.passwordChangedAt.toISOString(),
        purpose: "access",
      },
      secret,
    );
    const probe = await fetch(`${server.base}/api/core/probe`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(probe.status, 403);
    assert.deepEqual(await probe.json(), {
      error: { message: PASSWORD_CHANGE_REQUIRED },
    });
  } finally {
    await server.close();
  }
});

test("change-password limita 5 intentos por IP", async () => {
  const record = await account({ password: "valid-password" });
  const repository = new MemoryAuthRepository([record]);
  const server = await listen(repository);
  try {
    const login = await post(server.base, "/auth/login", {
      email: record.email,
      password: "valid-password",
    });
    const token = String(login.body.token);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await post(
        server.base,
        "/auth/change-password",
        { currentPassword: "other-password", nextPassword: "replacement-1" },
        token,
        { "x-forwarded-for": `10.1.1.${attempt}` },
      );
      assert.equal(response.status, 401);
    }
    const blocked = await post(
      server.base,
      "/auth/change-password",
      { currentPassword: "other-password", nextPassword: "replacement-1" },
      token,
      { "x-forwarded-for": "10.8.8.8" },
    );
    assert.equal(blocked.status, 429);
    assert.equal(repository.historyFor(record.id).length, 0);
  } finally {
    await server.close();
  }
});

test("cinco logins fallidos y el sexto recibe 429", async () => {
  const record = await account({ password: "valid-password" });
  const repository = new MemoryAuthRepository([record]);
  const server = await listen(repository);
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await post(server.base, "/auth/login", {
        email: record.email,
        password: "other-password",
      });
      assert.equal(response.status, 401);
    }
    const blocked = await post(server.base, "/auth/login", {
      email: record.email,
      password: "other-password",
    });
    assert.equal(blocked.status, 429);
    assert.deepEqual(blocked.body, { error: { message: RATE_LIMITED } });
  } finally {
    await server.close();
  }
});

test("un login correcto no consume un intento fallido", async () => {
  const record = await account({ password: "valid-password" });
  const repository = new MemoryAuthRepository([record]);
  const server = await listen(repository);
  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await post(server.base, "/auth/login", {
        email: record.email,
        password: "other-password",
      });
      assert.equal(response.status, 401);
    }
    const success = await post(server.base, "/auth/login", {
      email: record.email,
      password: "valid-password",
    });
    assert.equal(success.status, 200);
    const stillAllowed = await post(server.base, "/auth/login", {
      email: record.email,
      password: "other-password",
    });
    assert.equal(stillAllowed.status, 401);
    const blocked = await post(server.base, "/auth/login", {
      email: record.email,
      password: "other-password",
    });
    assert.equal(blocked.status, 429);
  } finally {
    await server.close();
  }
});

test("validación y token inválido no consumen el límite de credenciales", async () => {
  const record = await account({ password: "valid-password" });
  const repository = new MemoryAuthRepository([record]);
  const server = await listen(repository);
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await post(server.base, "/auth/login", {});
      assert.equal(response.status, 400);
    }
    const wrong = await post(server.base, "/auth/login", {
      email: record.email,
      password: "other-password",
    });
    assert.equal(wrong.status, 401);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await post(server.base, "/auth/change-password", {
        nextPassword: "replacement-1",
      });
      assert.equal(response.status, 401);
      assert.deepEqual(response.body, { error: { message: UNAUTHORIZED } });
    }
    const login = await post(server.base, "/auth/login", {
      email: record.email,
      password: "valid-password",
    });
    const token = String(login.body.token);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await post(
        server.base,
        "/auth/change-password",
        { currentPassword: "other-password", nextPassword: "replacement-1" },
        token,
      );
      assert.equal(response.status, 401);
      assert.deepEqual(response.body, { error: { message: INVALID_CREDENTIALS } });
    }
    const blocked = await post(
      server.base,
      "/auth/change-password",
      { currentPassword: "other-password", nextPassword: "replacement-1" },
      token,
    );
    assert.equal(blocked.status, 429);
  } finally {
    await server.close();
  }
});

test("login y change-password no comparten contador", async () => {
  const record = await account({ password: "valid-password" });
  const repository = new MemoryAuthRepository([record]);
  const server = await listen(repository);
  try {
    const login = await post(server.base, "/auth/login", {
      email: record.email,
      password: "valid-password",
    });
    const token = String(login.body.token);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await post(server.base, "/auth/login", {
        email: record.email,
        password: "other-password",
      });
      assert.equal(response.status, 401);
    }
    const loginBlocked = await post(server.base, "/auth/login", {
      email: record.email,
      password: "other-password",
    });
    assert.equal(loginBlocked.status, 429);
    const change = await post(
      server.base,
      "/auth/change-password",
      { currentPassword: "other-password", nextPassword: "replacement-1" },
      token,
    );
    assert.equal(change.status, 401);
    assert.deepEqual(change.body, { error: { message: INVALID_CREDENTIALS } });
  } finally {
    await server.close();
  }
});

test("cambiar el password invalida el access token y el token restringido", async () => {
  const record = await account({ password: "valid-password" });
  const repository = new MemoryAuthRepository([record]);
  const server = await listen(repository);
  try {
    const login = await post(server.base, "/auth/login", {
      email: record.email,
      password: "valid-password",
    });
    const access = String(login.body.token);
    const restricted = signToken(
      {
        userId: record.id,
        companyId: "company-a",
        passwordChangedAt: record.passwordChangedAt.toISOString(),
        purpose: "password_change",
      },
      secret,
    );
    const changed = await post(
      server.base,
      "/auth/change-password",
      { currentPassword: "valid-password", nextPassword: "replacement-1" },
      restricted,
    );
    assert.equal(changed.status, 200);
    const probe = await fetch(`${server.base}/api/core/probe`, {
      headers: { authorization: `Bearer ${access}` },
    });
    assert.equal(probe.status, 401);
    const staleChange = await post(
      server.base,
      "/auth/change-password",
      { currentPassword: "replacement-1", nextPassword: "replacement-2" },
      restricted,
    );
    assert.equal(staleChange.status, 401);
    const staleAccess = await post(
      server.base,
      "/auth/change-password",
      { currentPassword: "replacement-1", nextPassword: "replacement-2" },
      access,
    );
    assert.equal(staleAccess.status, 401);
  } finally {
    await server.close();
  }
});

test("un error 500 no devuelve ni registra password ni hash", async () => {
  const passwordHash = await hashPassword("valid-password", rounds);
  const record = await account({ password: "valid-password" });
  const repository = new MemoryAuthRepository([record]);
  const app = createApp({
    config: config(),
    prisma: {} as PrismaClient,
    authRepository: repository,
    bcryptRounds: rounds,
    now: () => fixedNow,
    mount(application) {
      application.get("/api/core/boom", (_req, _res, next) => {
        const failure = new Error(
          `fallo passwordHash=${passwordHash} Bearer ${secret}.token.signature password=valid-password`,
        );
        Object.assign(failure, { passwordHash, authorization: `Bearer ${secret}` });
        next(failure);
      });
    },
  });
  const server = await new Promise<Server>((resolve) => {
    const started = app.listen(0, "127.0.0.1", () => resolve(started));
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map((item) => String(item)).join(" "));
  };
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/core/boom`);
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.deepEqual(body, {
      error: { message: "No se pudo completar la solicitud." },
    });
    const logged = lines.join("\n");
    assert.equal(logged.includes(passwordHash), false);
    assert.equal(logged.includes("valid-password"), false);
    assert.equal(logged.includes(secret), false);
    assert.equal(JSON.stringify(body).includes(passwordHash), false);
  } finally {
    console.error = original;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
