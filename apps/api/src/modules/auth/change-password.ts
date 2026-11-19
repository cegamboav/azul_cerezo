import { AppError } from "../core/app-error.js";
import {
  INVALID_CREDENTIALS,
  INVALID_REQUEST,
  PASSWORD_CHANGE_CONFLICT,
} from "./messages.js";
import {
  assertCurrentPassword,
  assertPasswordReuse,
  hashPassword,
  verifyPassword,
} from "./password.js";
import type { AuthRepository } from "./types.js";

export async function changePassword(input: {
  userId: string;
  currentPassword: string;
  nextPassword: string;
  now: Date;
  rounds: number;
  repository: AuthRepository;
  beforeCommit?: () => Promise<void>;
}): Promise<void> {
  const user = await input.repository.findById(input.userId);
  if (!user) {
    throw new AppError(401, INVALID_CREDENTIALS);
  }
  const history = await input.repository.readHistory(input.userId);
  await assertCurrentPassword({
    currentPassword: input.currentPassword,
    currentHash: user.passwordHash,
    verify: verifyPassword,
  });
  await assertPasswordReuse({
    nextPassword: input.nextPassword,
    currentHash: user.passwordHash,
    historyNewestFirst: history,
    verify: verifyPassword,
  });
  const nextHash = await hashPassword(input.nextPassword, input.rounds);
  if (input.beforeCommit) {
    await input.beforeCommit();
  }
  const outcome = await input.repository.commitPasswordChange({
    userId: user.id,
    expectedPasswordChangedAt: user.passwordChangedAt,
    expectedPasswordHash: user.passwordHash,
    previousHash: user.passwordHash,
    nextHash,
    passwordChangedAt: input.now,
  });
  if (outcome === "missing") {
    throw new AppError(401, INVALID_CREDENTIALS);
  }
  if (outcome === "conflict") {
    throw new AppError(409, PASSWORD_CHANGE_CONFLICT);
  }
}

export function readPasswordChange(body: unknown): {
  currentPassword: string;
  nextPassword: string;
} {
  if (typeof body !== "object" || body === null) {
    throw new AppError(400, INVALID_REQUEST);
  }
  const record = body as Record<string, unknown>;
  if (
    typeof record.currentPassword !== "string" ||
    typeof record.nextPassword !== "string" ||
    record.currentPassword === "" ||
    record.nextPassword === ""
  ) {
    throw new AppError(400, INVALID_REQUEST);
  }
  return {
    currentPassword: record.currentPassword,
    nextPassword: record.nextPassword,
  };
}
