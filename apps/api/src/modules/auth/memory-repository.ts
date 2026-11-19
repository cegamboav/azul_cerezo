import { commitLockedPasswordChange } from "./password-change.js";
import type {
  AuthRepository,
  HistoryEntry,
  PasswordCommit,
  PasswordCommitResult,
  UserRecord,
} from "./types.js";

export class MemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, UserRecord>();
  private readonly history = new Map<string, HistoryEntry[]>();
  private readonly tails = new Map<string, Promise<void>>();
  private sequence = 0;

  constructor(users: UserRecord[]) {
    for (const user of users) {
      this.users.set(user.id, cloneUser(user));
      this.history.set(user.id, []);
    }
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = [...this.users.values()].find((item) => item.email === email);
    return user ? cloneUser(user) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const user = this.users.get(id);
    return user ? cloneUser(user) : null;
  }

  async readHistory(userId: string): Promise<HistoryEntry[]> {
    return this.newestHistory(userId);
  }

  historyFor(userId: string): HistoryEntry[] {
    return this.newestHistory(userId);
  }

  async commitPasswordChange(input: PasswordCommit): Promise<PasswordCommitResult> {
    return this.lock(input.userId, async () => {
      const io = {
        readUser: async () => {
          const user = this.users.get(input.userId);
          return user ? cloneUser(user) : null;
        },
        readHistory: async () => this.newestHistory(input.userId),
        insertHistory: async (entry: {
          passwordHash: string;
          createdAt: Date;
        }) => {
          const rows = this.history.get(input.userId) ?? [];
          this.sequence += 1;
          rows.push({
            id: `history-${this.sequence}`,
            passwordHash: entry.passwordHash,
            createdAt: entry.createdAt,
          });
          this.history.set(input.userId, rows);
        },
        updatePassword: async (update: {
          passwordHash: string;
          passwordChangedAt: Date;
        }) => {
          const user = this.users.get(input.userId);
          if (!user) {
            return;
          }
          user.passwordHash = update.passwordHash;
          user.passwordChangedAt = update.passwordChangedAt;
          user.mustChangePassword = false;
        },
        deleteHistory: async (ids: string[]) => {
          const drop = new Set(ids);
          this.history.set(
            input.userId,
            (this.history.get(input.userId) ?? []).filter(
              (entry) => !drop.has(entry.id),
            ),
          );
        },
      };
      return commitLockedPasswordChange(io, input);
    });
  }

  private newestHistory(userId: string): HistoryEntry[] {
    return [...(this.history.get(userId) ?? [])]
      .sort((left, right) => {
        const byTime = right.createdAt.getTime() - left.createdAt.getTime();
        if (byTime !== 0) {
          return byTime;
        }
        return right.id.localeCompare(left.id);
      })
      .map((entry) => ({ ...entry }));
  }

  private async lock<T>(userId: string, work: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(userId) ?? Promise.resolve();
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => gate);
    this.tails.set(userId, tail);
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }
}

function cloneUser(user: UserRecord): UserRecord {
  return {
    ...user,
    passwordChangedAt: new Date(user.passwordChangedAt),
    memberships: user.memberships.map((membership) => ({
      ...membership,
      permissions: [...membership.permissions],
    })),
  };
}
