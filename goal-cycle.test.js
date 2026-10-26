import test from "node:test";
import assert from "node:assert/strict";
import { cycleEnd, endedDate, nextAvailableStart, selectGoal, unfinishedGoal } from "./public/goal-cycle.js";

const goals = [
  { id: 2, start_date: "2026-10-07", duration_days: 7 },
  { id: 1, start_date: "2026-09-30", duration_days: 7 },
];

test("a goal must end before another is created, even if their dates do not overlap", () => {
  assert.equal(unfinishedGoal([goals[1]], "2026-10-04").id, 1);
  assert.equal(unfinishedGoal([goals[0]], "2026-10-04").id, 2);
  assert.equal(unfinishedGoal([{ ...goals[1], ended_at: "2026-10-04T12:00:00Z" }], "2026-10-04"), null);
  assert.equal(unfinishedGoal([goals[1]], "2026-10-07"), null);
  assert.equal(unfinishedGoal([goals[1]], "2026-10-06", [{goal_id:1,date:"2026-10-06",met:true}]), null);
});

test("Track chooses the current cycle but respects an explicitly selected future cycle", () => {
  assert.equal(selectGoal(goals, "2026-10-04").id, 1);
  assert.equal(selectGoal(goals, "2026-10-04", 2).id, 2);
  assert.equal(selectGoal(goals, "2026-10-08").id, 2);
  assert.equal(cycleEnd(goals[1]), "2026-10-06");
  assert.equal(selectGoal([], "2026-10-04"), null);
});

test("Track defaults to a started cycle before a scheduled future cycle", () => {
  const history = { id: 3, start_date: "2026-09-20", duration_days: 7 };
  assert.equal(selectGoal([goals[0], history], "2026-10-04").id, 3);
  assert.equal(selectGoal([goals[0], history], "2026-10-04", 2).id, 2);
});

test("persisted end dates do not shift with the display timezone", () => {
  const goal = { ended_date: "2026-10-04", ended_at: "2026-10-05T01:00:00Z" };
  assert.equal(endedDate(goal, "Pacific/Kiritimati"), "2026-10-04");
  assert.equal(endedDate(goal, "America/New_York"), "2026-10-04");
});

test("new goals default to a date after existing contiguous cycles", () => {
  assert.equal(nextAvailableStart(goals, "2026-10-04"), "2026-10-14");
  assert.equal(nextAvailableStart([], "2026-10-04"), "2026-10-04");
  assert.equal(nextAvailableStart([{...goals[1], ended_at:"2026-10-04T12:00:00Z",ended_date:"2026-10-04"}],"2026-10-04"),"2026-10-04");
});
