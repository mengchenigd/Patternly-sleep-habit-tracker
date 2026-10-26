import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

function run(script, dbPath) {
  return spawnSync(process.execPath, [script], {
    encoding: "utf8", env: { ...process.env, DB_PATH: dbPath },
  });
}

test("provisioning creates ordinary demo users and a separate admin without resetting accounts", () => {
  const dbPath = path.join(mkdtempSync(path.join(tmpdir(), "patternly-provision-")), "users.sqlite");
  const seeded = run("scripts/seed-demo.js", dbPath);
  assert.equal(seeded.status, 0, seeded.stderr);
  assert.equal(JSON.parse(seeded.stdout).length, 2);
  const again = run("scripts/seed-demo.js", dbPath);
  assert.equal(again.status, 0, again.stderr);
  assert.ok(JSON.parse(again.stdout).every(account => !account.password));
  const admin = run("scripts/create-admin.js", dbPath);
  assert.equal(admin.status, 0, admin.stderr);
  assert.equal(run("scripts/create-admin.js", dbPath).status, 1);
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const accounts = db.prepare("SELECT username,is_admin FROM users ORDER BY username").all();
    assert.deepEqual(accounts.map(account => [account.username, account.is_admin]), [
      ["admin", 1], ["alice", 0], ["bob", 0],
    ]);
    assert.equal(db.prepare("SELECT count(*) AS count FROM records").get().count, 60);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db.close();
  }
});
