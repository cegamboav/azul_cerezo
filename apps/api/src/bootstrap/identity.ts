import type { PrismaClient } from "@azul/database";
import {
  ROLE_KEYS,
  ROLE_NAMES,
  ROLE_PERMISSIONS,
} from "../modules/core/permissions.js";
import { hashPassword, PASSWORD_MIN_LENGTH } from "../modules/auth/password.js";
import type { BootstrapArgs } from "./args.js";
import { generateTemporaryPassword } from "./temporary-password.js";

export const INITIAL_COMPANY = {
  country: "US",
  region: "FL",
  currency: "USD",
  timezone: "America/New_York",
  locale: "es",
} as const;

export const CONFIRMATION_REQUIRED =
  "Bootstrap requires explicit confirmation.";

export const ALREADY_INITIALIZED =
  "Bootstrap aborted: database is already initialized.";

const BOOTSTRAP_LOCK =
  "SELECT pg_advisory_xact_lock(hashtext('azul-identity-bootstrap')::bigint)";

export class BootstrapAborted extends Error {
  constructor() {
    super(ALREADY_INITIALIZED);
    this.name = "BootstrapAborted";
  }
}

type IdentityReader = {
  company: { count: () => Promise<number> };
  user: { count: () => Promise<number> };
  membership: { count: () => Promise<number> };
};

async function databaseHasIdentity(db: IdentityReader): Promise<boolean> {
  const [companies, users, memberships] = await Promise.all([
    db.company.count(),
    db.user.count(),
    db.membership.count(),
  ]);
  return companies > 0 || users > 0 || memberships > 0;
}

export interface BootstrapCompleted {
  status: "completed";
  temporaryPassword: string;
  slug: string;
  tradeName: string;
  ownerEmail: string;
}

export interface BootstrapRunOptions {
  now?: Date;
  rounds?: number;
  generatePassword?: () => string;
  beforeTransaction?: () => Promise<void>;
  beforeCommit?: () => Promise<void>;
}

export async function runBootstrap(
  args: BootstrapArgs,
  prisma: PrismaClient,
  options: BootstrapRunOptions = {},
): Promise<{ status: "aborted" } | BootstrapCompleted> {
  if (!args.confirm) {
    throw new Error(CONFIRMATION_REQUIRED);
  }
  if (await databaseHasIdentity(prisma)) {
    return { status: "aborted" };
  }

  const temporaryPassword =
    options.generatePassword?.() ?? generateTemporaryPassword();
  if (temporaryPassword.length < PASSWORD_MIN_LENGTH) {
    throw new Error("Temporary password does not meet policy.");
  }
  const passwordHash = await hashPassword(temporaryPassword, options.rounds);
  const passwordChangedAt = options.now ?? new Date();
  if (options.beforeTransaction) {
    await options.beforeTransaction();
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(BOOTSTRAP_LOCK);
      if (await databaseHasIdentity(tx)) {
        throw new BootstrapAborted();
      }

      const company = await tx.company.create({
        data: {
          legalName: args.legalName,
          tradeName: args.tradeName,
          slug: args.slug,
          phone: args.companyPhone,
          email: args.companyEmail,
          country: INITIAL_COMPANY.country,
          region: INITIAL_COMPANY.region,
          currency: INITIAL_COMPANY.currency,
          timezone: INITIAL_COMPANY.timezone,
          locale: INITIAL_COMPANY.locale,
          primaryColor: args.primaryColor,
        },
        select: { id: true },
      });

      let ownerRoleId = "";
      for (const key of ROLE_KEYS) {
        const role = await tx.role.create({
          data: {
            companyId: company.id,
            key,
            name: ROLE_NAMES[key],
          },
          select: { id: true },
        });
        if (key === "OWNER") {
          ownerRoleId = role.id;
        }
        const permissions = ROLE_PERMISSIONS[key];
        if (permissions.length > 0) {
          await tx.rolePermission.createMany({
            data: permissions.map((permissionKey) => ({
              companyId: company.id,
              roleId: role.id,
              permissionKey,
            })),
          });
        }
      }
      if (ownerRoleId === "") {
        throw new Error("Bootstrap failed.");
      }

      const user = await tx.user.create({
        data: {
          email: args.email,
          name: args.name,
          phone: args.phone ?? null,
          passwordHash,
          passwordChangedAt,
          mustChangePassword: true,
          isActive: true,
        },
        select: { id: true },
      });

      await tx.membership.create({
        data: {
          companyId: company.id,
          userId: user.id,
          roleId: ownerRoleId,
          isActive: true,
        },
        select: { id: true },
      });

      if (options.beforeCommit) {
        await options.beforeCommit();
      }
    });
  } catch (error) {
    if (error instanceof BootstrapAborted) {
      return { status: "aborted" };
    }
    throw error;
  }

  return {
    status: "completed",
    temporaryPassword,
    slug: args.slug,
    tradeName: args.tradeName,
    ownerEmail: args.email,
  };
}
