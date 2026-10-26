import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { migrateRecordDates } from "./record-dates.js";

test("sleep moves to its night once, preserving habits, gaps and boundary nights", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE records(user_id INTEGER NOT NULL,date TEXT NOT NULL,
    caffeine REAL NOT NULL,sleep REAL NOT NULL,sleep_quality INTEGER,updated_at TEXT NOT NULL,
    PRIMARY KEY(user_id,date));
    INSERT INTO records VALUES(1,'2026-10-03',100,6,2,'stamp'),
      (1,'2026-10-04',200,8,4,'stamp'),(1,'2026-10-06',50,7,3,'stamp');`);
  assert.equal(migrateRecordDates(db), true);
  const rows = db.prepare("SELECT date,caffeine,sleep,sleep_quality FROM records ORDER BY date").all();
  assert.deepEqual(rows.map(row => [row.date,row.caffeine,row.sleep,row.sleep_quality]), [
    ['2026-10-02',null,6,2],['2026-10-03',100,8,4],['2026-10-04',200,null,null],
    ['2026-10-05',null,7,3],['2026-10-06',50,null,null],
  ]);
  assert.equal(migrateRecordDates(db), false);
  assert.deepEqual(db.prepare("SELECT date,caffeine,sleep,sleep_quality FROM records ORDER BY date").all(), rows);
  db.close();
});
