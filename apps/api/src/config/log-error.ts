const BCRYPT_HASH = /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const BEARER = /Bearer\s+\S+/gi;
const SENSITIVE_ASSIGNMENT =
  /((?:password|passwordhash|authorization|jwt_secret|secret)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|\S+)/gi;

export function sanitizeLogText(value: string): string {
  return value
    .replace(BCRYPT_HASH, "[redacted]")
    .replace(JWT, "[redacted]")
    .replace(BEARER, "Bearer [redacted]")
    .replace(SENSITIVE_ASSIGNMENT, "$1[redacted]");
}

export function formatErrorForLog(prefix: string, error: unknown): string {
  if (!(error instanceof Error)) {
    return `${prefix} UnknownError: Error no serializable`;
  }
  const message = sanitizeLogText(error.message);
  const header = `${prefix} ${error.name}: ${message}`;
  if (!error.stack) {
    return header;
  }
  return `${header}\n${sanitizeLogText(error.stack)}`;
}
