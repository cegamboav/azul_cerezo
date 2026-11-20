import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { after, before, beforeEach, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createPrismaClient, type PrismaClient } from "@azul/database";
import {
  createEmbeddedCluster,
  destroyEmbeddedCluster,
  type EmbeddedCluster,
} from "../testing/embedded-postgres-cluster.test.js";
import {
  INVALID_BOOTSTRAP_ARGS,
  MISSING_BOOTSTRAP_ARGS,
  PASSWORD_ARGUMENT_REJECTED,
  parseBootstrapArgs,
} from "./args.js";
import { executeBootstrap, formatBootstrapSuccess } from "./execute.js";
import { ALREADY_INITIALIZED, CONFIRMATION_REQUIRED, runBootstrap } from "./identity.js";
import { generateTemporaryPassword } from "./temporary-password.js";
import { PASSWORD_MIN_LENGTH, verifyPassword } from "../modules/auth/password.js";
import {
  PERMISSIONS,
  ROLE_KEYS,
  ROLE_NAMES,
  ROLE_PERMISSIONS,
} from "../modules/core/permissions.js";

const databaseName = "azul_bootstrap_test";

function repoRoot(): string {
  let current = path.dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(path.join(current, "prisma.config.ts"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  throw new Error("No se encontró la raíz del repositorio.");
}

function sqlStatements(source: string): string[] {
  return source
    .split(/;\s*(?:\r?\n|$)/)
    .map((part) => part.trim())
    .filter((part) =>
      part.split(/\r?\n/).some((line) => {
        const trimmed = line.trim();
        return trimmed !== "" && !trimmed.startsWith("--");
      }),
    );
}

async function applyMigrations(prisma: PrismaClient): Promise<void> {
  const migrationsDir = path.join(
    repoRoot(),
    "packages",
    "database",
    "prisma",
    "migrations",
  );
  const directories = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const directory of directories) {
    const sql = readFileSync(
      path.join(migrationsDir, directory, "migration.sql"),
      "utf8",
    );
    for (const statement of sqlStatements(sql)) {
      await prisma.$executeRawUnsafe(statement);
    }
  }
}

function ownerArgs(input: {
  email?: string;
  slug?: string;
  confirm?: boolean;
  phone?: string;
  name?: string;
}): string[] {
  const args = [
    "--email",
    input.email ?? "owner@example.com",
    "--name",
    input.name ?? "Owner Example",
    "--legal-name",
    "Example Services LLC",
    "--trade-name",
    "Example Services",
    "--slug",
    input.slug ?? "example-services",
    "--primary-color",
    "#123456",
    "--company-phone",
    "5550100",
    "--company-email",
    "office@example.com",
  ];
  if (input.phone !== undefined) {
    args.push("--phone", input.phone);
  }
  if (input.confirm !== false) {
    args.push("--confirm");
  }
  return args;
}

function untouchedDatabase(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get() {
      throw new Error("database was touched");
    },
  });
}

test("sin --confirm no abre la base", async () => {
  let opened = false;
  const stderr: string[] = [];
  const stdout: string[] = [];
  const code = await executeBootstrap(ownerArgs({ confirm: false }), {
    openDatabase() {
      opened = true;
      return untouchedDatabase();
    },
    stderr(message) {
      stderr.push(message);
    },
    stdout(message) {
      stdout.push(message);
    },
  });
  assert.equal(code, 1);
  assert.equal(opened, false);
  assert.deepEqual(stdout, []);
  assert.equal(stderr.join(""), `${CONFIRMATION_REQUIRED}\n`);
});

test("runBootstrap sin confirm no consulta la base", async () => {
  const parsed = parseBootstrapArgs(ownerArgs({ confirm: false }));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    return;
  }
  await assert.rejects(
    () => runBootstrap(parsed.value, untouchedDatabase()),
    (error: unknown) =>
      error instanceof Error && error.message === CONFIRMATION_REQUIRED,
  );
});

test("argumentos faltantes no abren la base", async () => {
  let opened = false;
  const stderr: string[] = [];
  const code = await executeBootstrap(["--confirm"], {
    openDatabase() {
      opened = true;
      return untouchedDatabase();
    },
    stderr(message) {
      stderr.push(message);
    },
  });
  assert.equal(code, 1);
  assert.equal(opened, false);
  assert.equal(stderr.join(""), `${MISSING_BOOTSTRAP_ARGS}\n`);
});

test("un email inválido y --password no abren la base ni revelan el valor", async () => {
  let opened = false;
  const stderr: string[] = [];
  const secret = "plain-password-must-stay-hidden";
  const invalid = await executeBootstrap(
    ownerArgs({ email: "not-an-email" }),
    {
      openDatabase() {
        opened = true;
        return untouchedDatabase();
      },
      stderr(message) {
        stderr.push(message);
      },
    },
  );
  const rejected = await executeBootstrap(
    [...ownerArgs({}), "--password", secret],
    {
      openDatabase() {
        opened = true;
        return untouchedDatabase();
      },
      stderr(message) {
        stderr.push(message);
      },
    },
  );
  assert.equal(invalid, 1);
  assert.equal(rejected, 1);
  assert.equal(opened, false);
  assert.equal(stderr[0], `${INVALID_BOOTSTRAP_ARGS}\n`);
  assert.equal(stderr[1], `${PASSWORD_ARGUMENT_REJECTED}\n`);
  assert.equal(stderr.join("").includes(secret), false);
});

test("el parser recorta el email sin cambiar mayúsculas", () => {
  const args = ownerArgs({ confirm: false }).flatMap((token) =>
    token === "owner@example.com" ? ["  Owner@Example.com  "] : [token],
  );
  const parsed = parseBootstrapArgs(args);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.email, "Owner@Example.com");
    assert.equal(parsed.value.confirm, false);
  }
});

test("la contraseña temporal cumple la política y no es fija", () => {
  const first = generateTemporaryPassword();
  const second = generateTemporaryPassword();
  assert.equal(first.length >= PASSWORD_MIN_LENGTH, true);
  assert.equal(/^[A-Za-z0-9]+$/.test(first), true);
  assert.equal(first === second, false);
});

test("el resultado exitoso no incluye hash, secreto ni URL", () => {
  const passwordHash = "$2b$12$abcdefghijklmnopqrstuv";
  const jwtSecret = "jwt-secret-marker-not-for-output";
  const databaseUrl = "postgresql://sentinel:sentinel@127.0.0.1:1/sentinel";
  const output = formatBootstrapSuccess({
    company: "Example Services (example-services)",
    owner: "owner@example.com",
    temporaryPassword: "temporary-pass",
  });
  assert.equal(output.includes(passwordHash), false);
  assert.equal(output.includes(jwtSecret), false);
  assert.equal(output.includes(databaseUrl), false);
  assert.equal(output.includes("postgresql://"), false);
  assert.equal(output.startsWith("Bootstrap completed successfully.\n"), true);
  assert.equal(output.includes("Temporary password:\ntemporary-pass\n"), true);
});

describe("bootstrap contra PostgreSQL aislado", { concurrency: false, timeout: 120_000 }, () => {
  let cluster: EmbeddedCluster | undefined;
  let connectionString = "";
  let prisma: PrismaClient | undefined;

  before(async () => {
    cluster = await createEmbeddedCluster({
      databaseName,
      dataDirPrefix: "azul-bootstrap-pg-",
    });
    connectionString = cluster.connectionString;
    prisma = createPrismaClient(connectionString);
    await applyMigrations(prisma);
  });

  beforeEach(async () => {
    await prisma?.$executeRawUnsafe(
      'TRUNCATE TABLE "Membership", "RolePermission", "Role", "PasswordHistory", "User", "Company", "CompanySetting", "CancellationPolicy", "CancellationPolicyTier" CASCADE',
    );
  });

  after(async () => {
    await prisma?.$disconnect();
    await destroyEmbeddedCluster(cluster);
  });

  function requirePrisma(): PrismaClient {
    if (!prisma) {
      throw new Error("PostgreSQL de prueba no está listo.");
    }
    return prisma;
  }

  async function counts(): Promise<{
    companies: number;
    users: number;
    roles: number;
    permissions: number;
    memberships: number;
    settings: number;
    policies: number;
    history: number;
  }> {
    const db = requirePrisma();
    const [
      companies,
      users,
      roles,
      permissions,
      memberships,
      settings,
      policies,
      history,
    ] = await Promise.all([
      db.company.count(),
      db.user.count(),
      db.role.count(),
      db.rolePermission.count(),
      db.membership.count(),
      db.companySetting.count(),
      db.cancellationPolicy.count(),
      db.passwordHistory.count(),
    ]);
    return {
      companies,
      users,
      roles,
      permissions,
      memberships,
      settings,
      policies,
      history,
    };
  }

  test("inicializa company, roles, permisos, usuario y membership", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const code = await executeBootstrap(
      ownerArgs({ phone: "5550199", email: "Owner@Example.com" }),
      {
        openDatabase: () => createPrismaClient(connectionString),
        stdout(message) {
          stdout.push(message);
        },
        stderr(message) {
          stderr.push(message);
        },
        run: { rounds: 4, now: new Date("2026-07-01T00:00:00.000Z") },
      },
    );
    const output = stdout.join("");
    const password = output.split("\n")[7] ?? "";
    assert.equal(code, 0);
    assert.deepEqual(stderr, []);
    assert.equal(
      output,
      formatBootstrapSuccess({
        company: "Example Services (example-services)",
        owner: "Owner@Example.com",
        temporaryPassword: password,
      }),
    );
    assert.equal(output.includes(connectionString), false);
    assert.equal(output.includes("passwordHash"), false);
    assert.equal(output.includes("JWT_SECRET"), false);

    const db = requirePrisma();
    const company = await db.company.findUniqueOrThrow({
      where: { slug: "example-services" },
    });
    assert.equal(company.legalName, "Example Services LLC");
    assert.equal(company.tradeName, "Example Services");
    assert.equal(company.country, "US");
    assert.equal(company.region, "FL");
    assert.equal(company.currency, "USD");
    assert.equal(company.timezone, "America/New_York");
    assert.equal(company.locale, "es");
    assert.equal(company.primaryColor, "#123456");
    assert.equal(company.phone, "5550100");
    assert.equal(company.email, "office@example.com");

    const roles = await db.role.findMany({
      where: { companyId: company.id },
      include: { permissions: true },
      orderBy: { key: "asc" },
    });
    assert.deepEqual(
      roles.map((role) => role.key).sort(),
      [...ROLE_KEYS].sort(),
    );
    for (const role of roles) {
      const key = ROLE_KEYS.find((candidate) => candidate === role.key);
      assert.ok(key);
      assert.equal(role.name, ROLE_NAMES[key]);
      assert.deepEqual(
        role.permissions.map((permission) => permission.permissionKey).sort(),
        [...ROLE_PERMISSIONS[key]].sort(),
      );
    }
    const owner = roles.find((role) => role.key === "OWNER");
    const admin = roles.find((role) => role.key === "ADMIN");
    const coordinator = roles.find((role) => role.key === "COORDINATOR");
    assert.equal(owner?.permissions.some((item) => item.permissionKey === "quotes.send"), true);
    assert.equal(admin?.permissions.some((item) => item.permissionKey === "quotes.send"), true);
    assert.equal(
      coordinator?.permissions.some((item) => item.permissionKey === "quotes.send"),
      false,
    );
    assert.equal(admin?.permissions.some((item) => item.permissionKey === "settings.manage"), false);
    assert.deepEqual(
      owner?.permissions.map((item) => item.permissionKey).sort(),
      [...PERMISSIONS].sort(),
    );

    const user = await db.user.findUniqueOrThrow({
      where: { email: "Owner@Example.com" },
    });
    assert.equal(user.name, "Owner Example");
    assert.equal(user.phone, "5550199");
    assert.equal(user.isActive, true);
    assert.equal(user.mustChangePassword, true);
    assert.equal(user.passwordChangedAt.toISOString(), "2026-07-01T00:00:00.000Z");
    assert.equal(user.passwordHash === password, false);
    assert.equal(user.passwordHash.startsWith("$2"), true);
    assert.equal(output.includes(user.passwordHash), false);
    assert.equal(await verifyPassword(password, user.passwordHash), true);

    const membership = await db.membership.findFirstOrThrow({
      where: { userId: user.id },
      include: { role: true },
    });
    assert.equal(membership.companyId, company.id);
    assert.equal(membership.isActive, true);
    assert.equal(membership.role.key, "OWNER");

    const totals = await counts();
    assert.deepEqual(totals, {
      companies: 1,
      users: 1,
      roles: 5,
      permissions: PERMISSIONS.length + (PERMISSIONS.length - 1) + ROLE_PERMISSIONS.COORDINATOR.length,
      memberships: 1,
      settings: 0,
      policies: 0,
      history: 0,
    });
  });

  test("una segunda ejecución se aborta sin crear registros", async () => {
    const first = await executeBootstrap(ownerArgs({}), {
      openDatabase: () => createPrismaClient(connectionString),
      stdout() {
        return undefined;
      },
      run: { rounds: 4, generatePassword: () => "temporary-pass" },
    });
    const stderr: string[] = [];
    const stdout: string[] = [];
    const second = await executeBootstrap(
      ownerArgs({ email: "other@example.com", slug: "other-services" }),
      {
        openDatabase: () => createPrismaClient(connectionString),
        stderr(message) {
          stderr.push(message);
        },
        stdout(message) {
          stdout.push(message);
        },
        run: { rounds: 4, generatePassword: () => "another-temporary" },
      },
    );
    assert.equal(first, 0);
    assert.equal(second, 1);
    assert.deepEqual(stdout, []);
    assert.equal(stderr.join(""), `${ALREADY_INITIALIZED}\n`);
    assert.deepEqual(await counts(), {
      companies: 1,
      users: 1,
      roles: 5,
      permissions: PERMISSIONS.length + (PERMISSIONS.length - 1) + ROLE_PERMISSIONS.COORDINATOR.length,
      memberships: 1,
      settings: 0,
      policies: 0,
      history: 0,
    });
    const db = requirePrisma();
    assert.equal(await db.user.count({ where: { email: "other@example.com" } }), 0);
    assert.equal(await db.company.count({ where: { slug: "other-services" } }), 0);
  });

  test("un fallo dentro de la transacción revierte todo", async () => {
    const parsed = parseBootstrapArgs(ownerArgs({}));
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    const db = requirePrisma();
    await assert.rejects(
      () =>
        runBootstrap(parsed.value, db, {
          rounds: 4,
          generatePassword: () => "temporary-pass",
          beforeCommit: () => Promise.reject(new Error("forced-bootstrap-failure")),
        }),
      (error: unknown) => {
        assert.equal(error instanceof Error, true);
        if (error instanceof Error) {
          assert.equal(error.message, "forced-bootstrap-failure");
          assert.equal(error.message.includes("temporary-pass"), false);
        }
        return true;
      },
    );
    assert.deepEqual(await counts(), {
      companies: 0,
      users: 0,
      roles: 0,
      permissions: 0,
      memberships: 0,
      settings: 0,
      policies: 0,
      history: 0,
    });
  });

  test("dos bootstraps concurrentes dejan una sola identidad", async () => {
    const firstOut: string[] = [];
    const secondOut: string[] = [];
    const firstErr: string[] = [];
    const secondErr: string[] = [];
    let arrived = 0;
    let release: () => void = () => undefined;
    const bothPassedPrecheck = new Promise<void>((resolve) => {
      release = resolve;
    });
    const beforeTransaction = async () => {
      arrived += 1;
      if (arrived === 2) {
        release();
      }
      await bothPassedPrecheck;
    };
    const [first, second] = await Promise.all([
      executeBootstrap(
        ownerArgs({ email: "one@example.com", slug: "one-services", name: "One Owner" }),
        {
          openDatabase: () => createPrismaClient(connectionString),
          stdout(message) {
            firstOut.push(message);
          },
          stderr(message) {
            firstErr.push(message);
          },
          run: {
            rounds: 4,
            generatePassword: () => "temporary-one",
            beforeTransaction,
          },
        },
      ),
      executeBootstrap(
        ownerArgs({ email: "two@example.com", slug: "two-services", name: "Two Owner" }),
        {
          openDatabase: () => createPrismaClient(connectionString),
          stdout(message) {
            secondOut.push(message);
          },
          stderr(message) {
            secondErr.push(message);
          },
          run: {
            rounds: 4,
            generatePassword: () => "temporary-two",
            beforeTransaction,
          },
        },
      ),
    ]);
    const codes = [first, second].sort();
    assert.deepEqual(codes, [0, 1]);
    const outputs = [firstOut.join(""), secondOut.join("")].filter((item) => item !== "");
    const errors = [firstErr.join(""), secondErr.join("")].filter((item) => item !== "");
    assert.equal(outputs.length, 1);
    assert.equal(errors.length, 1);
    assert.equal(errors[0], `${ALREADY_INITIALIZED}\n`);
    const db = requirePrisma();
    assert.equal(await db.company.count(), 1);
    assert.equal(await db.user.count(), 1);
    assert.equal(await db.membership.count(), 1);
    assert.equal(await db.role.count(), 5);
    const saved = await db.user.findFirstOrThrow();
    const winner = outputs[0]?.includes("one@example.com")
      ? "temporary-one"
      : "temporary-two";
    assert.equal(await verifyPassword(winner, saved.passwordHash), true);
    assert.equal(outputs[0]?.includes(saved.passwordHash), false);
    assert.equal(outputs[0]?.includes(connectionString), false);
  });
});
