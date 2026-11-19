import { AppError } from "../core/app-error.js";
import { logger } from "../../config/logger.js";
import type { TokenPurpose } from "./jwt.js";
import { signToken } from "./jwt.js";
import { INVALID_CREDENTIALS, TOKEN_TTL_SECONDS } from "./messages.js";
import {
  dummyPasswordHash,
  isPasswordExpired,
  verifyPassword,
} from "./password.js";
import type { AuthRepository } from "./types.js";

export interface LoginResult {
  token: string;
  purpose: TokenPurpose;
  expiresIn: number;
}

export async function authenticateLogin(input: {
  email: string;
  password: string;
  now: Date;
  secret: string;
  rounds: number;
  repository: AuthRepository;
  verify?: (plain: string, passwordHash: string) => Promise<boolean>;
}): Promise<LoginResult> {
  const verify = input.verify ?? verifyPassword;
  const user = await input.repository.findByEmail(input.email);
  const passwordHash = user
    ? user.passwordHash
    : await dummyPasswordHash(input.rounds);
  const passwordMatches = await verify(input.password, passwordHash);
  if (!user || !passwordMatches || !user.isActive) {
    throw new AppError(401, INVALID_CREDENTIALS);
  }

  const active = user.memberships.filter((membership) => membership.isActive);
  if (active.length !== 1) {
    if (active.length > 1) {
      logger.info(`Login rechazado: multiples membresias userId=${user.id}`);
    }
    throw new AppError(401, INVALID_CREDENTIALS);
  }

  const membership = active[0];
  if (!membership) {
    throw new AppError(401, INVALID_CREDENTIALS);
  }
  const purpose: TokenPurpose =
    user.mustChangePassword || isPasswordExpired(user.passwordChangedAt, input.now)
      ? "password_change"
      : "access";

  return {
    token: signToken(
      {
        userId: user.id,
        companyId: membership.companyId,
        passwordChangedAt: user.passwordChangedAt.toISOString(),
        purpose,
      },
      input.secret,
    ),
    purpose,
    expiresIn: TOKEN_TTL_SECONDS,
  };
}
