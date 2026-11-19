import type { RequestHandler } from "express";
import type { AuthRepository } from "../modules/auth/types.js";
import { establishSession } from "./session.js";

export function requireAuth(options: {
  secret: string;
  repository: AuthRepository;
  now?: () => Date;
}): RequestHandler {
  return (req, _res, next) => {
    void establishSession(req, {
      secret: options.secret,
      repository: options.repository,
      now: options.now,
      purposes: ["access"],
      rejectRestricted: true,
      grantPermissions: true,
      wrongPurposeStatus: 403,
    })
      .then((auth) => {
        req.auth = auth;
        next();
      })
      .catch(next);
  };
}
