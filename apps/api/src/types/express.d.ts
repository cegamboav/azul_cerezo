import type { AuthContext } from "../modules/auth/context.js";

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthContext;
  }
}
