import { randomInt } from "node:crypto";
import { PASSWORD_MIN_LENGTH } from "../modules/auth/password.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const TEMPORARY_PASSWORD_LENGTH = 20;

export function generateTemporaryPassword(): string {
  let password = "";
  for (let index = 0; index < TEMPORARY_PASSWORD_LENGTH; index += 1) {
    password += ALPHABET[randomInt(ALPHABET.length)];
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error("Temporary password does not meet policy.");
  }
  return password;
}
