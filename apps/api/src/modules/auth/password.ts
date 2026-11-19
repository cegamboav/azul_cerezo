import bcrypt from "bcrypt";
import { AppError } from "../core/app-error.js";
import {
  INVALID_CREDENTIALS,
  PASSWORD_REUSED,
  PASSWORD_TOO_SHORT,
} from "./messages.js";

export const BCRYPT_ROUNDS = 12;
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_HISTORY_LIMIT = 6;

const DUMMY_PASSWORD = "not-a-real-user-password";

interface DummySlot {
  hash?: string;
  pending?: Promise<string>;
}

const dummySlots = new Map<number, DummySlot>();

export function clearDummyPasswordCache(rounds?: number): void {
  if (rounds === undefined) {
    dummySlots.clear();
    return;
  }
  dummySlots.delete(rounds);
}

export async function hashPassword(
  plain: string,
  rounds = BCRYPT_ROUNDS,
): Promise<string> {
  return bcrypt.hash(plain, rounds);
}

export async function verifyPassword(
  plain: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, passwordHash);
}

export async function dummyPasswordHash(
  rounds = BCRYPT_ROUNDS,
  generate: (cost: number) => Promise<string> = (cost) =>
    hashPassword(DUMMY_PASSWORD, cost),
): Promise<string> {
  const existing = dummySlots.get(rounds);
  if (existing?.hash) {
    return existing.hash;
  }
  if (existing?.pending) {
    return existing.pending;
  }
  const pending = generate(rounds)
    .then((hash) => {
      dummySlots.set(rounds, { hash });
      return hash;
    })
    .catch((error: unknown) => {
      const current = dummySlots.get(rounds);
      if (current?.pending === pending) {
        dummySlots.delete(rounds);
      }
      throw error;
    });
  dummySlots.set(rounds, { pending });
  return pending;
}

export function addCalendarMonths(from: Date, months: number): Date {
  const absoluteMonth = from.getUTCMonth() + months;
  const targetYear = from.getUTCFullYear() + Math.floor(absoluteMonth / 12);
  const targetMonth = ((absoluteMonth % 12) + 12) % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  const targetDay = Math.min(from.getUTCDate(), lastDay);
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds(),
    ),
  );
}

export function isPasswordExpired(
  passwordChangedAt: Date,
  now: Date,
): boolean {
  return now.getTime() >= addCalendarMonths(passwordChangedAt, 6).getTime();
}

export function historyIdsToDelete(
  idsNewestFirst: readonly string[],
): string[] {
  return idsNewestFirst.slice(PASSWORD_HISTORY_LIMIT);
}

export interface PasswordHistoryView {
  id: string;
  passwordHash: string;
  createdAt: Date;
}

export async function assertPasswordReuse(input: {
  nextPassword: string;
  currentHash: string;
  historyNewestFirst: readonly PasswordHistoryView[];
  verify: (plain: string, passwordHash: string) => Promise<boolean>;
}): Promise<void> {
  if (input.nextPassword.length < PASSWORD_MIN_LENGTH) {
    throw new AppError(400, PASSWORD_TOO_SHORT);
  }
  if (await input.verify(input.nextPassword, input.currentHash)) {
    throw new AppError(400, PASSWORD_REUSED);
  }
  const recent = input.historyNewestFirst.slice(0, PASSWORD_HISTORY_LIMIT);
  for (const entry of recent) {
    if (await input.verify(input.nextPassword, entry.passwordHash)) {
      throw new AppError(400, PASSWORD_REUSED);
    }
  }
}

export async function assertCurrentPassword(input: {
  currentPassword: string;
  currentHash: string;
  verify: (plain: string, passwordHash: string) => Promise<boolean>;
}): Promise<void> {
  const matches = await input.verify(input.currentPassword, input.currentHash);
  if (!matches) {
    throw new AppError(401, INVALID_CREDENTIALS);
  }
}
