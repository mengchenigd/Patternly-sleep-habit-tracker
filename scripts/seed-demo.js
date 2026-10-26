import { randomBytes } from "node:crypto";
import { db } from "../database.js";
import { hashPassword } from "../passwords.js";
import { dateInZone } from "../public/dates.js";
import { demoRecords } from "./demo-records.js";

const end = dateInZone(process.env.DEMO_TIME_ZONE || "UTC");
const stamp = new Date().toISOString();
const accounts = [];
// Generate credentials only for new accounts; rerunning never resets data.
try {
  for (const name of ["Alice", "Bob"]) {
    const username = name.toLowerCase();
    if (db.prepare("SELECT id FROM users WHERE username=?").get(username)) {
      accounts.push({ username, status: "exists; unchanged" });
      continue;
    }
    const password = `${name}-` + randomBytes(12).toString("hex");
    const passwordHash = await hashPassword(password);
    const rows = demoRecords(end).map((row, index) => {
      if (name === "Alice") return row;
      const rested = index === 0 || (index - 1) % 2 === 0;
      return { ...row, caffeine: 100, exercise: 20, exercise_type: "Walking",
        screen: index % 2 ? 4.5 : 1.5, sleep: rested ? 7.8 : 6.1,
        sleep_quality: rested ? 4 : 2, mood: rested ? 4 : 3, water: 2 };
    });
    db.exec("BEGIN IMMEDIATE");
    try {
      const id = Number(db.prepare("INSERT INTO users(username,password_hash,created_at,is_demo,is_admin,tutorial_completed_at) VALUES(?,?,?,1,0,?)")
        .run(username, passwordHash, Date.now(), Date.now()).lastInsertRowid);
      db.prepare("INSERT INTO profiles(user_id,name,age_range,schedule,bedtime,wake_time,sleep_target,updated_at) VALUES(?,?,?,?,?,?,?,?)")
        .run(id, name, "25–34", "Regular daytime", "23:00", "07:00", 8, stamp);
      const insert = db.prepare("INSERT INTO records(user_id,date,caffeine,intake,exercise,screen,sleep,mood,updated_at,exercise_type,sleep_quality,water) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)");
      for (const row of rows) {
        insert.run(id, row.date, row.caffeine, row.intake, row.exercise, row.screen,
          row.sleep, row.mood, stamp, row.exercise_type, row.sleep_quality, row.water);
      }
      db.exec("COMMIT");
      accounts.push({ username, password, days: rows.length });
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  console.log(JSON.stringify(accounts, null, 2));
} finally {
  db.close();
}
