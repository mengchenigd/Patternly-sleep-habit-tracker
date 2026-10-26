import { requestOriginAllowed } from "./origin.js";
import { validDate, dateInZone } from "./public/dates.js";
import { unfinishedGoal } from "./public/goal-cycle.js";
import { sessionUser, authenticate, logout, authRateAllowed } from "./auth.js";
import http from "node:http";
import { db, snapshot, adminSnapshot } from "./database.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const port = Number(process.env.PORT || 4173);
const cloudOrigin = process.env.CODESPACE_NAME
  ? `https://${process.env.CODESPACE_NAME}-${port}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || "app.github.dev"}`
  : null;
const publicOrigin = process.env.APP_ORIGIN || cloudOrigin;
if (process.env.NODE_ENV === "production" && (!publicOrigin?.startsWith("https://") || !process.env.INVITE_CODE)) {
  throw new Error("Production requires HTTPS APP_ORIGIN and INVITE_CODE.");
}
if (publicOrigin && new URL(publicOrigin).origin !== publicOrigin) {
  throw new Error("APP_ORIGIN must be an origin without a trailing slash or path.");
}
const root = path.dirname(fileURLToPath(import.meta.url));
class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
function assert(condition, message) {
  if (!condition) throw new RequestError(message);
}
function number(value, max, integer = false) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= max &&
    (!integer || Number.isInteger(value))
  );
}
const server = http.createServer(async (req, res) => {
  const reply = (status, data) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  };
  try {
    const url = new URL(req.url, "http://localhost");
    // Reject arbitrary Host headers even for loopback connections (DNS rebinding).
    const hostname = new URL("http://" + req.headers.host).hostname;
    if (!["localhost", "127.0.0.1", "[::1]", ...(publicOrigin?[new URL(publicOrigin).hostname]:[])].includes(hostname))
      return reply(403, { error: "Host rejected" });
    if (url.pathname.startsWith("/api/")) {
      const user = sessionUser(req);
      const secure = Boolean(publicOrigin?.startsWith("https://"));
      if (req.method === "GET" && url.pathname === "/api/auth/session") {
        return reply(200, { user, inviteRequired: Boolean(process.env.INVITE_CODE) });
      }
      const authRoute = ["/api/auth/login", "/api/auth/register", "/api/auth/logout"].includes(url.pathname);
      if (!user && !authRoute) return reply(401, { error: "Sign in to continue." });
      if (req.method === "GET" && url.pathname === "/api/admin/database") {
        if (!user.is_admin) return reply(403, { error: "Administrator access required." });
        return reply(200, adminSnapshot());
      }
      if (req.method === "GET" && url.pathname === "/api/database") return reply(200, snapshot(user.id));
      if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
      // Legacy clients without a timezone use UTC, never the host timezone.
      const timeZone = req.headers['x-time-zone'] || 'UTC';
      let currentDate;
      try { currentDate = dateInZone(timeZone); }
      catch { throw new RequestError('Invalid timezone'); }
      const expectedOrigin = publicOrigin || `http://${req.headers.host}`;
      if (!requestOriginAllowed(req.headers, { expectedOrigin, codespaceOrigin: cloudOrigin, port }))
        return reply(403, { error: "Origin rejected" });
      if (authRoute && !authRateAllowed(req.socket.remoteAddress)) {
        return reply(429, { error: "Too many attempts. Try again in 15 minutes." });
      }
      assert(
        req.headers["content-type"]?.startsWith("application/json"),
        "JSON required",
      );
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        assert(raw.length <= 16000, "Request too large");
      }
      let b;
      try {
        b = JSON.parse(raw);
      } catch {
        throw new RequestError("Invalid JSON");
      }
      assert(
        b !== null && typeof b === "object" && !Array.isArray(b),
        "Expected a JSON object",
      );
      if (authRoute) {
        if (url.pathname === "/api/auth/logout") {
          logout(req, res, secure);
          return reply(200, { ok: true });
        }
        const mode = url.pathname.endsWith("/register") ? "register" : "login";
        const result = await authenticate(mode, b, req, res, secure);
        return reply(result.status || 200, result.error ? { error: result.error } : { user: result.user });
      }
      if (url.pathname === "/api/auth/tutorial-complete") {
        const completedAt = Date.now();
        db.prepare("UPDATE users SET tutorial_completed_at=COALESCE(tutorial_completed_at,?) WHERE id=?").run(completedAt,user.id);
        return reply(200, { user: sessionUser(req) });
      } else if (url.pathname === "/api/profile") {
        assert(
          typeof b.name === "string" &&
            b.name.trim().length > 0 &&
            b.name.length <= 80,
          "Please enter a name (up to 80 characters)",
        );
        assert(
          [
            "Prefer not to say",
            "Under 18",
            "18–24",
            "25–34",
            "35–44",
            "45–54",
            "55–64",
            "65+",
          ].includes(b.age_range),
          "Choose an age range",
        );
        assert(
          ["Regular daytime", "Shift work", "Flexible", "Other"].includes(
            b.schedule,
          ),
          "Choose a schedule",
        );
        assert(
          [b.bedtime, b.wake_time].every(
            (v) => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
          ),
          "Choose valid sleep times",
        );
        assert(
          number(b.sleep_target, 24) && b.sleep_target > 0,
          "Sleep target must be above 0 and at most 24 hours",
        );
        db.prepare(
          `INSERT INTO profiles (
            user_id,name,age_range,schedule,bedtime,wake_time,sleep_target,updated_at
          ) VALUES (?,?,?,?,?,?,?,?)
          ON CONFLICT(user_id) DO UPDATE SET
            name=excluded.name, age_range=excluded.age_range, schedule=excluded.schedule,
            bedtime=excluded.bedtime, wake_time=excluded.wake_time,
            sleep_target=excluded.sleep_target, updated_at=excluded.updated_at`,
        ).run(
          user.id,
          b.name.trim(),
          b.age_range,
          b.schedule,
          b.bedtime,
          b.wake_time,
          b.sleep_target,
          new Date().toISOString(),
        );
      } else if (url.pathname === "/api/records") {
        assert(validDate(b.date), "Valid date required");
        assert(b.date <= currentDate, "Future records are unavailable");
        assert(
          number(b.caffeine, 3000) &&
            number(b.exercise, 1440) &&
            number(b.screen, 24) &&
            (b.water == null || number(b.water, 20)) &&
            (b.sleep == null || number(b.sleep, 24)) &&
            number(b.mood, 5, true) &&
            b.mood >= 1,
          "Enter valid values within the field ranges",
        );
        assert(b.intake == null || b.intake === "" || (typeof b.intake === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(b.intake)), "Invalid intake time");
        assert(
          b.sleep_quality == null ||
            (number(b.sleep_quality, 5, true) && b.sleep_quality >= 1),
          "Sleep quality must be 1–5",
        );
        assert(
          [
            "None",
            "Walking",
            "Running",
            "Cycling",
            "Swimming",
            "Strength training",
            "Yoga",
            "Other",
            "Not specified",
          ].includes(b.exercise_type),
          "Choose an exercise type",
        );
        db.prepare(
          `INSERT INTO records (
            user_id,date,caffeine,intake,exercise,screen,sleep,mood,
            updated_at,exercise_type,sleep_quality,water
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(user_id,date) DO UPDATE SET
            caffeine=excluded.caffeine, intake=COALESCE(excluded.intake,records.intake),
            exercise=excluded.exercise, screen=excluded.screen,
            sleep=excluded.sleep, mood=excluded.mood, updated_at=excluded.updated_at,
            exercise_type=excluded.exercise_type, sleep_quality=excluded.sleep_quality,
            water=excluded.water`,
        ).run(
          user.id,
          b.date,
          b.caffeine,
          b.intake ?? null,
          b.exercise,
          b.screen,
          b.sleep,
          b.mood,
          new Date().toISOString(),
          b.exercise_type,
          b.sleep_quality ?? null,
          b.water ?? null,
        );
      } else if (["/api/goals", "/api/goals/update"].includes(url.pathname)) {
        assert(
          ["Caffeine", "Exercise", "Screen time", "Water intake", "Other"].includes(b.habit) &&
            typeof b.goal === "string" &&
            b.goal.trim().length > 0 &&
            b.goal.length <= 200 &&
            validDate(b.start_date),
          "Valid goal and start date required",
        );
        assert(
          number(b.duration_days, 365, true) && b.duration_days >= 1,
          "Choose a cycle duration from 1 to 365 days",
        );
        const updating = url.pathname === "/api/goals/update";
        let goal = null;
        if (updating) {
          assert(Number.isInteger(b.goal_id) && b.goal_id > 0, "Valid goal ID required");
          goal = db.prepare("SELECT * FROM goals WHERE id=? AND user_id=?").get(b.goal_id, user.id);
          assert(goal && !goal.ended_at, "Only an existing, unended goal can be edited");
          const outside = db.prepare(`SELECT date FROM checkins WHERE goal_id=?
            AND (date < ? OR date > date(?, '+' || (? - 1) || ' days'))`).get(
              goal.id, b.start_date, b.start_date, b.duration_days,
            );
          assert(!outside, "Keep existing check-ins within the goal dates");
        }
        db.exec("BEGIN IMMEDIATE");
        try {
          if (!updating) {
            const existing = snapshot(user.id);
            if (unfinishedGoal(existing.goals, currentDate, existing.checkins)) {
              throw new RequestError("Your current goal has not ended. Give it up or complete the cycle before creating another goal.", 409);
            }
          }
          const overlap = db.prepare(`SELECT id FROM goals
            WHERE user_id=? AND id != ?
            AND start_date <= date(?, '+' || (? - 1) || ' days')
            AND (CASE WHEN ended_at IS NULL THEN date(start_date, '+' || (duration_days - 1) || ' days')
              ELSE min(date(start_date, '+' || (duration_days - 1) || ' days'),
                date(COALESCE(ended_date, substr(ended_at,1,10)), '-1 day')) END) >= ?`).get(
                  user.id, goal?.id || 0, b.start_date, b.duration_days, b.start_date,
                );
          if (overlap) throw new RequestError("Another goal already covers these dates. Choose dates after that cycle, or end it first.", 409);
          if (updating) {
            db.prepare("UPDATE goals SET habit=?,goal=?,start_date=?,duration_days=? WHERE id=? AND user_id=?")
              .run(b.habit, b.goal.trim(), b.start_date, b.duration_days, goal.id, user.id);
          } else {
            db.prepare("INSERT INTO goals(user_id,habit,goal,start_date,duration_days) VALUES(?,?,?,?,?)")
              .run(user.id, b.habit, b.goal.trim(), b.start_date, b.duration_days);
          }
          db.exec("COMMIT");
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      } else if (url.pathname === "/api/goals/give-up") {
        assert(Number.isInteger(b.goal_id) && b.goal_id > 0, "Valid goal ID required");
        const goal = db.prepare("SELECT * FROM goals WHERE id=? AND user_id=?").get(b.goal_id, user.id);
        assert(goal, "Goal not found");
        if (goal.ended_at) return reply(200, snapshot(user.id));
        db.prepare("UPDATE goals SET ended_at=COALESCE(ended_at,?),ended_date=COALESCE(ended_date,?) WHERE id=? AND user_id=?")
          .run(new Date().toISOString(), currentDate, b.goal_id, user.id);
      } else if (["/api/checkins", "/api/checkins/cancel"].includes(url.pathname)) {
        assert(
          Number.isInteger(b.goal_id) && b.goal_id > 0,
          "Valid goal ID required",
        );
        const g = db.prepare("SELECT * FROM goals WHERE id=? AND user_id=?").get(b.goal_id,user.id);
        assert(
          g && !g.ended_at && validDate(b.date) && (url.pathname === "/api/checkins/cancel" || typeof b.met === "boolean"),
          "Valid goal, date and response required",
        );
        const day = (Date.parse(b.date) - Date.parse(g.start_date)) / 86400000;
        assert(
          day >= 0 && day < g.duration_days,
          "Date must fall within the configured cycle",
        );
        assert(
          b.date <= currentDate,
          "Future check-ins are unavailable",
        );
        if (url.pathname === "/api/checkins/cancel") {
          db.prepare("DELETE FROM checkins WHERE goal_id=? AND date=?").run(b.goal_id,b.date);
        } else db.prepare(
          "INSERT INTO checkins(goal_id,date,met) VALUES(?,?,?) ON CONFLICT(goal_id,date) DO UPDATE SET met=excluded.met",
        ).run(b.goal_id, b.date, Number(b.met));
      } else if (url.pathname === "/api/reviews") {
        assert(
          Number.isInteger(b.goal_id) &&
            typeof b.reflection === "string" &&
            b.reflection.length <= 2000,
          "Invalid reflection",
        );
        assert(
          db.prepare("SELECT id FROM goals WHERE id=? AND user_id=?").get(b.goal_id,user.id),
          "Goal not found",
        );
        db.prepare("UPDATE goals SET reflection=? WHERE id=? AND user_id=?").run(
          b.reflection,
          b.goal_id,
          user.id,
        );
      } else return reply(404, { error: "Unknown endpoint" });
      return reply(200, snapshot(user.id));
    }
    const allowed = {
      "/": "index.html",
      "/app.js": "app.js",
      "/dates.js": "dates.js",
      "/record-calendar.js": "record-calendar.js",
      "/form-controls.js": "form-controls.js",
      "/html.js": "html.js",
      "/summary-chart.js": "summary-chart.js",
      "/pattern-copy.js": "pattern-copy.js",
      "/insights.js": "insights.js",
      "/goal-progress.js": "goal-progress.js",
      "/goal-cycle.js": "goal-cycle.js",
      "/summary-model.js": "summary-model.js",
      "/summary-view.js": "summary-view.js",
      "/forms-view.js": "forms-view.js",
      "/profile-view.js": "profile-view.js",
      "/track-view.js": "track-view.js",
      "/admin-view.js": "admin-view.js",
      "/styles.css": "styles.css",
    };
    const file =
      allowed[url.pathname] ||
      (/^\/assets\/[a-z0-9]+\.svg$/.test(url.pathname)
        ? url.pathname.slice(1)
        : null);
    if (!file) return reply(404, { error: "Not found" });
    const type = file.endsWith(".css")
      ? "text/css"
      : file.endsWith(".js")
        ? "text/javascript"
        : file.endsWith(".svg")
          ? "image/svg+xml"
          : "text/html";
    let contents;
    try {
      contents = readFileSync(path.join(root, "public", file));
    } catch (error) {
      if (error.code === "ENOENT") return reply(404, { error: "Not found" });
      throw error;
    }
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(contents);
  } catch (e) {
    if (e instanceof RequestError) reply(e.status, { error: e.message });
    else {
      console.error("Request failed:", e);
      reply(500, { error: "Internal server error" });
    }
  }
});
server.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(`Patternly: http://localhost:${process.env.PORT || 4173}`),
);
