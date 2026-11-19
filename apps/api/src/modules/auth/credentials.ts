import { AppError } from "../core/app-error.js";
import { INVALID_REQUEST } from "./messages.js";

export function readLogin(body: unknown): { email: string; password: string } {
  if (typeof body !== "object" || body === null) {
    throw new AppError(400, INVALID_REQUEST);
  }
  const record = body as Record<string, unknown>;
  if (typeof record.email !== "string" || typeof record.password !== "string") {
    throw new AppError(400, INVALID_REQUEST);
  }
  const email = record.email.trim();
  if (email === "" || record.password === "") {
    throw new AppError(400, INVALID_REQUEST);
  }
  return { email, password: record.password };
}
