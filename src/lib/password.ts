import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export function passwordError(password: string): string | null {
  if (password.length < 8 || password.length > 128) {
    return "Heslo musí mít 8 až 128 znaků.";
  }
  return null;
}

export function emailError(email: string): string | null {
  const value = email.trim().toLowerCase();
  if (value.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "E-mail nemá platnou podobu.";
  }
  return null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scryptAsync(password, salt, 32)) as Buffer;
  return `scrypt$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hex] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hex) return false;
  const key = (await scryptAsync(password, salt, 32)) as Buffer;
  const expected = Buffer.from(hex, "hex");
  if (expected.length !== key.length) return false;
  return timingSafeEqual(expected, key);
}
