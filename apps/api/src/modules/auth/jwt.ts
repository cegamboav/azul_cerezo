import jwt from "jsonwebtoken";
import { AppError } from "../core/app-error.js";
import { SESSION_EXPIRED, TOKEN_TTL_SECONDS, UNAUTHORIZED } from "./messages.js";

export type TokenPurpose = "access" | "password_change";

export interface TokenClaims {
  userId: string;
  companyId: string;
  passwordChangedAt: string;
  purpose: TokenPurpose;
}

export function signToken(
  claims: TokenClaims,
  secret: string,
  ttlSeconds = TOKEN_TTL_SECONDS,
): string {
  return jwt.sign(claims, secret, {
    algorithm: "HS256",
    expiresIn: ttlSeconds,
  });
}

export function verifyToken(token: string, secret: string): TokenClaims {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (!isTokenClaims(payload)) {
      throw new AppError(401, UNAUTHORIZED);
    }
    return {
      userId: payload.userId,
      companyId: payload.companyId,
      passwordChangedAt: payload.passwordChangedAt,
      purpose: payload.purpose,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, SESSION_EXPIRED);
    }
    throw new AppError(401, UNAUTHORIZED);
  }
}

function isTokenClaims(value: unknown): value is TokenClaims {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.userId === "string" &&
    record.userId !== "" &&
    typeof record.companyId === "string" &&
    record.companyId !== "" &&
    typeof record.passwordChangedAt === "string" &&
    !Number.isNaN(Date.parse(record.passwordChangedAt)) &&
    (record.purpose === "access" || record.purpose === "password_change")
  );
}
