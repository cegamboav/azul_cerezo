import type { RequestHandler } from "express";
import type { AuthRepository } from "../modules/auth/types.js";
import { establishSession } from "./session.js";

export function requirePasswordChange(options: {
  secret: string;
  repository: AuthRepository;
}): RequestHandler {
  return (req, _res, next) => {
    void establishSession(req, {
      secret: options.secret,
      repository: options.repository,
      purposes: ["password_change"],
      rejectRestricted: false,
      grantPermissions: false,
      wrongPurposeStatus: 401,
    })
      .then((auth) => {
        req.auth = auth;
        next();
      })
      .catch(next);
  };
}

export function requirePasswordUpdate(options: {
  secret: string;
  repository: AuthRepository;
  now?: () => Date;
}): RequestHandler {
  return (req, _res, next) => {
    void establishSession(req, {
      secret: options.secret,
      repository: options.repository,
      now: options.now,
      purposes: ["access", "password_change"],
      rejectRestricted: "when-access",
      grantPermissions: false,
      wrongPurposeStatus: 401,
    })
      .then((auth) => {
        req.auth = auth;
        next();
      })
      .catch(next);
  };
}
