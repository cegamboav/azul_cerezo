import type { PrismaClient } from "@azul/database";
import { commitLockedPasswordChange } from "./password-change.js";
import type {
  AuthRepository,
  HistoryEntry,
  MembershipRecord,
  PasswordCommit,
  PasswordCommitResult,
  UserRecord,
} from "./types.js";

const userInclude = {
  memberships: {
    include: {
      role: {
        include: {
          permissions: true,
        },
      },
    },
  },
} as const;

type UserWithAccess = NonNullable<
  Awaited<
    ReturnType<
      PrismaClient["user"]["findUnique"]
    >
  >
>;

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: userInclude,
    });
    return user ? mapUser(user) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: userInclude,
    });
    return user ? mapUser(user) : null;
  }

  async readHistory(userId: string): Promise<HistoryEntry[]> {
    const rows = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(mapHistory);
  }

  async commitPasswordChange(input: PasswordCommit): Promise<PasswordCommitResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${input.userId} FOR UPDATE`;
      const io = {
        readUser: async () => {
          const user = await tx.user.findUnique({
            where: { id: input.userId },
            include: userInclude,
          });
          return user ? mapUser(user) : null;
        },
        readHistory: async () => {
          const rows = await tx.passwordHistory.findMany({
            where: { userId: input.userId },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          });
          return rows.map(mapHistory);
        },
        insertHistory: async (entry: {
          passwordHash: string;
          createdAt: Date;
        }) => {
          await tx.passwordHistory.create({
            data: {
              userId: input.userId,
              passwordHash: entry.passwordHash,
              createdAt: entry.createdAt,
            },
          });
        },
        updatePassword: async (update: {
          passwordHash: string;
          passwordChangedAt: Date;
        }) => {
          await tx.user.update({
            where: { id: input.userId },
            data: {
              passwordHash: update.passwordHash,
              passwordChangedAt: update.passwordChangedAt,
              mustChangePassword: false,
            },
          });
        },
        deleteHistory: async (ids: string[]) => {
          await tx.passwordHistory.deleteMany({ where: { id: { in: ids } } });
        },
      };
      return commitLockedPasswordChange(io, input);
    });
  }
}

function mapHistory(entry: {
  id: string;
  passwordHash: string;
  createdAt: Date;
}): HistoryEntry {
  return {
    id: entry.id,
    passwordHash: entry.passwordHash,
    createdAt: entry.createdAt,
  };
}

function mapUser(user: UserWithAccess): UserRecord {
  const record = user as UserWithAccess & {
    passwordHash: string;
    isActive: boolean;
    passwordChangedAt: Date;
    mustChangePassword: boolean;
    memberships: Array<{
      id: string;
      companyId: string;
      isActive: boolean;
      roleId: string;
      role: {
        id: string;
        key: string;
        permissions: Array<{ permissionKey: string }>;
      };
    }>;
  };
  return {
    id: record.id,
    email: record.email,
    passwordHash: record.passwordHash,
    isActive: record.isActive,
    passwordChangedAt: record.passwordChangedAt,
    mustChangePassword: record.mustChangePassword,
    memberships: record.memberships.map(mapMembership),
  };
}

function mapMembership(membership: {
  id: string;
  companyId: string;
  isActive: boolean;
  roleId: string;
  role: {
    key: string;
    permissions: Array<{ permissionKey: string }>;
  };
}): MembershipRecord {
  return {
    id: membership.id,
    companyId: membership.companyId,
    isActive: membership.isActive,
    roleId: membership.roleId,
    roleKey: membership.role.key,
    permissions: membership.role.permissions.map(
      (permission) => permission.permissionKey,
    ),
  };
}
