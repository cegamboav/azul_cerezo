import type { Request } from "express";
import { AppError } from "../modules/core/app-error.js";
import { verifyToken, type TokenClaims } from "../modules/auth/jwt.js";
import { UNAUTHORIZED } from "../modules/auth/messages.js";

export function readBearer(req: Request, secret: string): TokenClaims {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new AppError(401, UNAUTHORIZED);
  }
  const token = header.slice("Bearer ".length).trim();
  if (token === "") {
    throw new AppError(401, UNAUTHORIZED);
  }
  return verifyToken(token, secret);
}
