export const PERMISSIONS = [
  "clients.read",
  "clients.write",
  "quotes.read",
  "quotes.write",
  "quotes.review",
  "quotes.send",
  "visits.read",
  "visits.assign",
  "visits.execute",
  "visits.cancel",
  "billing.read",
  "billing.write",
  "users.manage",
  "settings.manage",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export const ROLE_KEYS = [
  "OWNER",
  "ADMIN",
  "COORDINATOR",
  "WORKER",
  "CLIENT",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

const coordinatorPermissions = [
  "clients.read",
  "clients.write",
  "quotes.read",
  "quotes.write",
  "quotes.review",
  "visits.read",
  "visits.assign",
  "visits.cancel",
  "billing.read",
] as const satisfies readonly PermissionKey[];

export const ROLE_PERMISSIONS: Record<RoleKey, readonly PermissionKey[]> = {
  OWNER: PERMISSIONS,
  ADMIN: PERMISSIONS.filter((permission) => permission !== "settings.manage"),
  COORDINATOR: coordinatorPermissions,
  WORKER: [],
  CLIENT: [],
};
