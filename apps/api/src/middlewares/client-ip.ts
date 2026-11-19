import type { Request } from "express";

export function clientIp(req: Request): string {
  const address = req.socket.remoteAddress;
  if (address && address.length > 0) {
    return address;
  }
  return "unknown";
}
