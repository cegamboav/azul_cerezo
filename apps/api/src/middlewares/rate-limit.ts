import type { RequestHandler, Response } from "express";
import { AppError } from "../modules/core/app-error.js";
import { INVALID_CREDENTIALS, RATE_LIMITED } from "../modules/auth/messages.js";
import { clientIp } from "./client-ip.js";

export interface RateLimiter {
  check(key: string, now?: number): boolean;
  recordFailure(key: string, now?: number): void;
}

export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
}): RateLimiter {
  const hits = new Map<string, number[]>();

  function recent(key: string, now: number): number[] {
    const active = (hits.get(key) ?? []).filter(
      (timestamp) => now - timestamp < options.windowMs,
    );
    hits.set(key, active);
    return active;
  }

  return {
    check(key: string, now = Date.now()): boolean {
      return recent(key, now).length < options.limit;
    },
    recordFailure(key: string, now = Date.now()): void {
      const active = recent(key, now);
      active.push(now);
      hits.set(key, active);
    },
  };
}

export function rateLimit(name: string, limiter: RateLimiter): RequestHandler {
  return (req, res, next) => {
    const key = `${name}:${clientIp(req)}`;
    if (!limiter.check(key)) {
      next(new AppError(429, RATE_LIMITED));
      return;
    }
    res.locals.recordCredentialFailure = () => {
      limiter.recordFailure(key);
    };
    next();
  };
}

export function recordCredentialFailure(res: Response, error: unknown): void {
  if (!(error instanceof AppError)) {
    return;
  }
  if (error.statusCode !== 401 || error.message !== INVALID_CREDENTIALS) {
    return;
  }
  const record = res.locals.recordCredentialFailure;
  if (typeof record === "function") {
    record();
  }
}
