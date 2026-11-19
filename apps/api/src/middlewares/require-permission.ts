import type { RequestHandler } from "express";
import { UNAUTHORIZED } from "../modules/auth/messages.js";
import { AppError } from "../modules/core/app-error.js";
import type { PermissionKey } from "../modules/core/permissions.js";

export function requirePermission(permission: PermissionKey): RequestHandler {
  return (req, _res, next) => {
    if (req.auth?.purpose !== "access") {
      next(new AppError(401, UNAUTHORIZED));
      return;
    }
    if (!req.auth.permissions.includes(permission)) {
      next(new AppError(403, UNAUTHORIZED));
      return;
    }
    next();
  };
}
