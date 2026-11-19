import type { Request } from "express";
import {
  activeMembership,
  sameInstant,
  type AuthContext,
} from "../modules/auth/context.js";
import type { TokenPurpose } from "../modules/auth/jwt.js";
import {
  PASSWORD_CHANGE_REQUIRED,
  UNAUTHORIZED,
} from "../modules/auth/messages.js";
import { isPasswordExpired } from "../modules/auth/password.js";
import type { AuthRepository } from "../modules/auth/types.js";
import { AppError } from "../modules/core/app-error.js";
import { readBearer } from "./bearer.js";

export async function establishSession(
  req: Request,
  options: {
    secret: string;
    repository: AuthRepository;
    now?: () => Date;
    purposes: readonly TokenPurpose[];
    rejectRestricted: boolean | "when-access";
    grantPermissions: boolean;
    wrongPurposeStatus: 401 | 403;
  },
): Promise<AuthContext> {
  const claims = readBearer(req, options.secret);
  if (!options.purposes.includes(claims.purpose)) {
    throw new AppError(options.wrongPurposeStatus, UNAUTHORIZED);
  }
  const user = await options.repository.findById(claims.userId);
  if (!user?.isActive) {
    throw new AppError(401, UNAUTHORIZED);
  }
  if (!sameInstant(user.passwordChangedAt, claims.passwordChangedAt)) {
    throw new AppError(401, UNAUTHORIZED);
  }
  const restricted =
    options.rejectRestricted === true ||
    (options.rejectRestricted === "when-access" && claims.purpose === "access");
  if (restricted) {
    const now = options.now?.() ?? new Date();
    if (
      user.mustChangePassword ||
      isPasswordExpired(user.passwordChangedAt, now)
    ) {
      throw new AppError(403, PASSWORD_CHANGE_REQUIRED);
    }
  }
  const membership = activeMembership(user, claims.companyId);
  if (!membership) {
    throw new AppError(401, UNAUTHORIZED);
  }
  return {
    userId: user.id,
    companyId: membership.companyId,
    purpose: claims.purpose,
    passwordChangedAt: user.passwordChangedAt,
    membershipId: membership.id,
    roleId: membership.roleId,
    roleKey: membership.roleKey,
    permissions: options.grantPermissions ? membership.permissions : [],
  };
}
