import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createPrismaClient, type PrismaClient } from "@azul/database";
import EmbeddedPostgres from "embedded-postgres";
import { AppError } from "../core/app-error.js";
import { changePassword } from "./change-password.js";
import { PrismaAuthRepository } from "./prisma-repository.js";
import { hashPassword, verifyPassword } from "./password.js";

const databaseName = "azul_auth_test";
const port = 55432;
const user = "postgres";
const password = "postgres";

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
  const migrationsDir = path.join(repoRoot(), "packages", "database", "prisma", "migrations");
  const directories = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const directory of directories) {
    const sql = readFileSync(path.join(migrationsDir, directory, "migration.sql"), "utf8");
    for (const statement of sqlStatements(sql)) {
      await prisma.$executeRawUnsafe(statement);
    }
  }
}

test("PostgreSQL impide que dos cambios concurrentes se sobrescriban", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "azul-auth-pg-"));
  const postgres = new EmbeddedPostgres({
    databaseDir: dataDir,
    port,
    user,
    password,
    persistent: false,
    onLog: () => undefined,
    onError: () => undefined,
  });
  let started = false;
  let prisma: PrismaClient | undefined;
  let companyId = "";
  let roleId = "";
  let userId = "";
  try {
    await postgres.initialise();
    await postgres.start();
    started = true;
    await postgres.createDatabase(databaseName);
    const connectionString = `postgresql://${user}:${password}@127.0.0.1:${port}/${databaseName}`;
    prisma = createPrismaClient(connectionString);
    await applyMigrations(prisma);

    const suffix = randomUUID();
    const originalPassword = "starting-pass";
    const originalChangedAt = new Date("2026-01-01T00:00:00.000Z");
    const company = await prisma.company.create({
      data: {
        legalName: "Auth Race",
        tradeName: "Auth Race",
        slug: `auth-race-${suffix}`,
        phone: "0000000000",
        email: `company-${suffix}@example.com`,
        country: "US",
        region: "FL",
        currency: "USD",
        timezone: "America/New_York",
        locale: "es",
        primaryColor: "#000000",
      },
    });
    companyId = company.id;
    const role = await prisma.role.create({
      data: { companyId, key: "OWNER", name: "Owner" },
    });
    roleId = role.id;
    const originalHash = await hashPassword(originalPassword, 4);
    const createdUser = await prisma.user.create({
      data: {
        email: `race-${suffix}@example.com`,
        name: "Race",
        passwordHash: originalHash,
        passwordChangedAt: originalChangedAt,
        mustChangePassword: true,
      },
    });
    userId = createdUser.id;
    await prisma.membership.create({
      data: { companyId, userId, roleId, isActive: true },
    });

    const repository = new PrismaAuthRepository(prisma);
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
        userId,
        currentPassword: originalPassword,
        nextPassword: "changed-pass-1",
        now: new Date("2026-06-01T00:00:00.000Z"),
        rounds: 4,
        repository,
        beforeCommit,
      }),
      changePassword({
        userId,
        currentPassword: originalPassword,
        nextPassword: "changed-pass-2",
        now: new Date("2026-06-01T00:00:01.000Z"),
        rounds: 4,
        repository,
        beforeCommit,
      }),
    ]);

    assert.equal(arrived, 2);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.equal(rejected?.status, "rejected");
    if (rejected?.status === "rejected") {
      assert.equal(rejected.reason instanceof AppError, true);
      assert.equal((rejected.reason as AppError).statusCode, 409);
    }

    const saved = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const history = await prisma.passwordHistory.findMany({ where: { userId } });
    assert.equal(history.length, 1);
    assert.equal(history[0]?.passwordHash, originalHash);
    assert.equal(saved.mustChangePassword, false);
    assert.equal(saved.passwordChangedAt.getTime() > originalChangedAt.getTime(), true);
    const matchesFirst = await verifyPassword("changed-pass-1", saved.passwordHash);
    const matchesSecond = await verifyPassword("changed-pass-2", saved.passwordHash);
    assert.equal(matchesFirst === matchesSecond, false);
    assert.equal(matchesFirst || matchesSecond, true);
  } finally {
    if (prisma && userId) {
      await prisma.membership.deleteMany({ where: { userId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    if (prisma && roleId) {
      await prisma.role.delete({ where: { id: roleId } }).catch(() => undefined);
    }
    if (prisma && companyId) {
      await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
    }
    await prisma?.$disconnect();
    if (started) {
      await postgres.stop();
    }
    await rm(dataDir, { recursive: true, force: true });
  }
});
