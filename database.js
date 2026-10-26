import { DatabaseSync } from "node:sqlite";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrateRecordDates } from "./record-dates.js";
const root = path.dirname(fileURLToPath(import.meta.url));
const filename = process.env.DB_PATH || path.join(root, "data/patternly-users.sqlite");
mkdirSync(path.dirname(filename), { recursive: true });
// Classroom packages include a read-only starting snapshot. Each checkout gets its own working database.
const demoSnapshot = path.join(root, "demo/patternly-demo.sqlite");
if (!process.env.DB_PATH && !existsSync(filename) && existsSync(demoSnapshot)) {
  copyFileSync(demoSnapshot, filename);
}
export const db = new DatabaseSync(filename);
const legacy = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='profiles'").get();
if (legacy && !db.prepare('PRAGMA table_info(profiles)').all().some(c => c.name === 'user_id')) {
  db.close();
  throw new Error('Legacy single-user database detected. Choose a new DB_PATH; do not assign shared records to a new account.');
}
db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
  CREATE TABLE IF NOT EXISTS profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    name TEXT NOT NULL,
    age_range TEXT NOT NULL,
    schedule TEXT NOT NULL,
    bedtime TEXT NOT NULL,
    wake_time TEXT NOT NULL,
    sleep_target REAL NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS records (
    user_id INTEGER NOT NULL REFERENCES users(id),
    date TEXT NOT NULL,
    caffeine REAL NOT NULL,
    intake TEXT,
    exercise REAL NOT NULL,
    screen REAL NOT NULL,
    sleep REAL NOT NULL,
    mood INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    exercise_type TEXT NOT NULL,
    sleep_quality INTEGER,
    PRIMARY KEY (user_id, date)
  );
  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    habit TEXT NOT NULL,
    goal TEXT NOT NULL,
    start_date TEXT NOT NULL,
    duration_days INTEGER NOT NULL,
    reflection TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS goals_user ON goals(user_id);
  CREATE TABLE IF NOT EXISTS checkins (
    goal_id INTEGER REFERENCES goals(id),
    date TEXT NOT NULL,
    met INTEGER NOT NULL CHECK (met IN (0, 1)),
    PRIMARY KEY (goal_id, date)
  );
`);

function addColumn(table, name, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some(column => column.name === name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}

// Additive migrations preserve unknown values and existing account ownership.
addColumn("records", "water", "REAL");
addColumn("users", "is_demo", "INTEGER NOT NULL DEFAULT 0");
addColumn("users", "is_admin", "INTEGER NOT NULL DEFAULT 0");
addColumn("users", "tutorial_completed_at", "INTEGER");
addColumn("goals", "ended_at", "TEXT");
addColumn("goals", "ended_date", "TEXT");
migrateRecordDates(db, `${filename}.before-night-dates-${Date.now()}.sqlite`);

export function snapshot(userId) {
  if (!Number.isInteger(userId)) throw new Error('Authenticated user required');
  return {
    profiles: db.prepare('SELECT * FROM profiles WHERE user_id=?').all(userId),
    records: db.prepare('SELECT * FROM records WHERE user_id=? ORDER BY date DESC').all(userId),
    goals: db.prepare('SELECT * FROM goals WHERE user_id=? ORDER BY id DESC').all(userId),
    checkins: db.prepare('SELECT c.* FROM checkins c JOIN goals g ON g.id=c.goal_id WHERE g.user_id=? ORDER BY c.date DESC').all(userId),
  };
}

// Callers must verify the administrator role before requesting this snapshot.
export function adminSnapshot() {
  return {
    users: db.prepare("SELECT id,username,is_demo,is_admin,created_at FROM users ORDER BY id").all(),
    profiles: db.prepare("SELECT * FROM profiles ORDER BY user_id").all(),
    records: db.prepare("SELECT * FROM records ORDER BY user_id,date DESC").all(),
    goals: db.prepare("SELECT * FROM goals ORDER BY user_id,id DESC").all(),
    checkins: db.prepare("SELECT * FROM checkins ORDER BY goal_id,date DESC").all(),
  };
}
