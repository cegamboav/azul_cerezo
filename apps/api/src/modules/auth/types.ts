export interface MembershipRecord {
  id: string;
  companyId: string;
  isActive: boolean;
  roleId: string;
  roleKey: string;
  permissions: string[];
}

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  passwordChangedAt: Date;
  mustChangePassword: boolean;
  memberships: MembershipRecord[];
}

export interface HistoryEntry {
  id: string;
  passwordHash: string;
  createdAt: Date;
}

export interface PasswordCommit {
  userId: string;
  expectedPasswordChangedAt: Date;
  expectedPasswordHash: string;
  previousHash: string;
  nextHash: string;
  passwordChangedAt: Date;
}

export type PasswordCommitResult = "missing" | "conflict" | "updated";

export interface PasswordIo {
  readUser(): Promise<UserRecord | null>;
  readHistory(): Promise<HistoryEntry[]>;
  insertHistory(entry: { passwordHash: string; createdAt: Date }): Promise<void>;
  updatePassword(update: {
    passwordHash: string;
    passwordChangedAt: Date;
  }): Promise<void>;
  deleteHistory(ids: string[]): Promise<void>;
}

export interface AuthRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  readHistory(userId: string): Promise<HistoryEntry[]>;
  commitPasswordChange(input: PasswordCommit): Promise<PasswordCommitResult>;
}
