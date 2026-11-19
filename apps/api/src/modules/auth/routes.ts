import { Router } from "express";
import type { RequestHandler } from "express";
import { recordCredentialFailure } from "../../middlewares/rate-limit.js";
import { requirePasswordUpdate } from "../../middlewares/require-password-change.js";
import { changePassword, readPasswordChange } from "./change-password.js";
import { readLogin } from "./credentials.js";
import { authenticateLogin } from "./login.js";
import type { AuthRepository } from "./types.js";

export function createAuthRouter(options: {
  secret: string;
  rounds: number;
  repository: AuthRepository;
  loginLimit: RequestHandler;
  changeLimit: RequestHandler;
  now?: () => Date;
}): Router {
  const router = Router();

  router.post("/auth/login", options.loginLimit, (req, res, next) => {
    void (async () => {
      const credentials = readLogin(req.body);
      try {
        const result = await authenticateLogin({
          email: credentials.email,
          password: credentials.password,
          now: options.now?.() ?? new Date(),
          secret: options.secret,
          rounds: options.rounds,
          repository: options.repository,
        });
        res.status(200).json(result);
      } catch (error) {
        recordCredentialFailure(res, error);
        throw error;
      }
    })().catch(next);
  });

  router.post(
    "/auth/change-password",
    options.changeLimit,
    requirePasswordUpdate({
      secret: options.secret,
      repository: options.repository,
      now: options.now,
    }),
    (req, res, next) => {
      void (async () => {
        const passwords = readPasswordChange(req.body);
        const auth = req.auth;
        if (!auth) {
          throw new Error("Falta el contexto de autenticación.");
        }
        try {
          await changePassword({
            userId: auth.userId,
            currentPassword: passwords.currentPassword,
            nextPassword: passwords.nextPassword,
            now: options.now?.() ?? new Date(),
            rounds: options.rounds,
            repository: options.repository,
          });
        } catch (error) {
          recordCredentialFailure(res, error);
          throw error;
        }
        res.status(200).json({ changed: true });
      })().catch(next);
    },
  );

  return router;
}
