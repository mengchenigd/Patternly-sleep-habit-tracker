import { randomBytes } from "node:crypto";
import { db } from "../database.js";
import { hashPassword } from "../passwords.js";

const username = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || "Admin-" + randomBytes(12).toString("hex");
try {
  if (!/^[a-z0-9_-]{3,32}$/.test(username) || password.length < 12 || password.length > 128) {
    throw new Error("Use a valid account name and a 12–128 character password.");
  }
  if (db.prepare("SELECT id FROM users WHERE username=?").get(username)) {
    throw new Error("Account already exists. No password or role was changed.");
  }
  db.prepare("INSERT INTO users(username,password_hash,created_at,is_admin,tutorial_completed_at) VALUES(?,?,?,1,?)")
    .run(username, await hashPassword(password), Date.now(), Date.now());
  console.log(JSON.stringify({ username, password }, null, 2));
} finally {
  db.close();
}
