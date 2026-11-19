import type { TokenPurpose } from "./jwt.js";
import type { MembershipRecord, UserRecord } from "./types.js";

export interface AuthContext {
  userId: string;
  companyId: string;
  purpose: TokenPurpose;
  passwordChangedAt: Date;
  membershipId: string;
  roleId: string;
  roleKey: string;
  permissions: readonly string[];
}

export function activeMembership(
  user: UserRecord,
  companyId: string,
): MembershipRecord | undefined {
  return user.memberships.find(
    (membership) => membership.companyId === companyId && membership.isActive,
  );
}

export function sameInstant(left: Date, iso: string): boolean {
  return left.getTime() === new Date(iso).getTime();
}
