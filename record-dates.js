import { addDays } from "./public/dates.js";

// One-time conversion: old sleep fields described the night before record.date.
export function migrateRecordDates(db, backupPath) {
  db.exec("CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)");
  const name = "sleep-night-date-v1";
  if (db.prepare("SELECT 1 FROM migrations WHERE name=?").get(name)) return false;
  const rows = db.prepare("SELECT * FROM records ORDER BY user_id,date").all();
  if (rows.length && backupPath) db.exec(`VACUUM INTO '${backupPath.replaceAll("'", "''")}'`);
  db.exec("BEGIN IMMEDIATE");
  try {
    // Partial boundary rows preserve the earliest night without inventing habits.
    const schema = db.prepare("SELECT sql FROM sqlite_master WHERE name='records'").get().sql;
    db.exec(schema.replace(/CREATE TABLE records/i, "CREATE TABLE records_converted").replaceAll(" NOT NULL", ""));
    db.exec("INSERT INTO records_converted SELECT * FROM records");
    db.exec("DROP TABLE records; ALTER TABLE records_converted RENAME TO records");
    db.exec("UPDATE records SET sleep=NULL,sleep_quality=NULL");
    const save = db.prepare(`INSERT INTO records(user_id,date,sleep,sleep_quality,updated_at)
      VALUES(?,?,?,?,?) ON CONFLICT(user_id,date) DO UPDATE SET
      sleep=excluded.sleep,sleep_quality=excluded.sleep_quality`);
    for (const row of rows) {
      if (row.sleep == null && row.sleep_quality == null) continue;
      save.run(row.user_id, addDays(row.date, -1), row.sleep, row.sleep_quality, row.updated_at);
    }
    db.prepare("INSERT INTO migrations(name) VALUES(?)").run(name);
    db.exec("COMMIT");
    return true;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
