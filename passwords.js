import { randomBytes, scrypt as deriveKey, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(deriveKey);

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password, passwordHash) {
  // Derive even for unknown accounts to avoid a fast enumeration path.
  const [salt, expected] = passwordHash?.split(":") || ["0".repeat(32), "0".repeat(128)];
  const key = await scrypt(password, salt, 64);
  return timingSafeEqual(key, Buffer.from(expected, "hex")) && Boolean(passwordHash);
}
