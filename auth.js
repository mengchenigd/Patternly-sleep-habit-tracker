import { randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { db } from "./database.js";
import { hashPassword, verifyPassword } from "./passwords.js";

const COOKIE_NAME = "patternly_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_AUTH_ATTEMPTS = 30;
const limits = new Map();
const hashToken = value => createHash("sha256").update(value).digest("hex");

export function authRateAllowed(key) {
  const now = Date.now();
  for (const [address, entry] of limits) {
    if (entry.until <= now) limits.delete(address);
  }
  if (!limits.has(key)) {
    if (limits.size >= 10000) return false;
    limits.set(key, { count: 0, until: now + RATE_WINDOW_MS });
  }
  return ++limits.get(key).count <= MAX_AUTH_ATTEMPTS;
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    is_demo: Boolean(user.is_demo),
    is_admin: Boolean(user.is_admin),
    tutorial_completed_at: user.tutorial_completed_at ?? null,
  };
}

function sessionToken(req) {
  return req.headers.cookie?.split(";").map(value => value.trim())
    .find(value => value.startsWith(COOKIE_NAME + "="))?.slice(COOKIE_NAME.length + 1);
}

export function sessionUser(req) {
  const token = sessionToken(req);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const user = db.prepare(`
    SELECT u.id,u.username,u.is_demo,u.is_admin,u.tutorial_completed_at
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>?
  `).get(hashToken(token), Date.now());
  return publicUser(user);
}

function sessionCookie(value, secure, maxAge) {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export function logout(req, res, secure) {
  const token = sessionToken(req);
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash=?").run(hashToken(token));
  res.setHeader("Set-Cookie", sessionCookie("", secure, 0));
}

export async function authenticate(mode, body, req, res, secure) {
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const validPassword = typeof body.password === "string" && body.password.length >= 12 && body.password.length <= 128;
  if (!/^[a-z0-9_-]{3,32}$/.test(username) || !validPassword) {
    return { status: 400, error: "Use a 3–32 character account name (letters, digits, _ or -) and a 12–128 character password." };
  }
  if (mode === "register" && process.env.INVITE_CODE) {
    const supplied = Buffer.from(hashToken(String(body.invite_code || "")));
    const expected = Buffer.from(hashToken(process.env.INVITE_CODE));
    if (!timingSafeEqual(supplied, expected)) {
      return { status: 403, error: "A valid team invitation code is required." };
    }
  }

  let user = db.prepare("SELECT * FROM users WHERE username=?").get(username);
  if (mode === "register") {
    if (user) return { status: 409, error: "Account name unavailable." };
    const passwordHash = await hashPassword(body.password);
    try {
      // Registration cannot accept a role or administrator flag from the client.
      const result = db.prepare("INSERT INTO users(username,password_hash,created_at,is_admin) VALUES(?,?,?,0)")
        .run(username, passwordHash, Date.now());
      user = { id: Number(result.lastInsertRowid), username };
    } catch (error) {
      if (error.code?.includes("CONSTRAINT") || String(error.message).includes("UNIQUE")) {
        return { status: 409, error: "Account name unavailable." };
      }
      throw error;
    }
  } else if (!await verifyPassword(body.password, user?.password_hash)) {
    return { status: 401, error: "Incorrect account name or password." };
  }

  logout(req, res, secure);
  const token = randomBytes(32).toString("hex");
  db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(Date.now());
  db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)")
    .run(hashToken(token), user.id, Date.now() + SESSION_DURATION_MS);
  res.setHeader("Set-Cookie", sessionCookie(token, secure, SESSION_DURATION_MS / 1000));
  return { user: publicUser(user) };
}
