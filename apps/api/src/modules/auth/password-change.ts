import { historyIdsToDelete } from "./password.js";
import type { PasswordIo } from "./types.js";

export async function commitLockedPasswordChange(
  io: PasswordIo,
  input: {
    expectedPasswordChangedAt: Date;
    expectedPasswordHash: string;
    previousHash: string;
    nextHash: string;
    passwordChangedAt: Date;
  },
): Promise<"missing" | "conflict" | "updated"> {
  const user = await io.readUser();
  if (!user) {
    return "missing";
  }
  if (
    user.passwordChangedAt.getTime() !== input.expectedPasswordChangedAt.getTime() ||
    user.passwordHash !== input.expectedPasswordHash
  ) {
    return "conflict";
  }
  const changedAt =
    input.passwordChangedAt.getTime() > user.passwordChangedAt.getTime()
      ? input.passwordChangedAt
      : new Date(user.passwordChangedAt.getTime() + 1);
  await io.insertHistory({
    passwordHash: input.previousHash,
    createdAt: changedAt,
  });
  await io.updatePassword({
    passwordHash: input.nextHash,
    passwordChangedAt: changedAt,
  });
  const after = await io.readHistory();
  const extra = historyIdsToDelete(after.map((entry) => entry.id));
  if (extra.length > 0) {
    await io.deleteHistory(extra);
  }
  return "updated";
}
