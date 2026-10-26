import test from "node:test";
import assert from "node:assert/strict";
import { summaryModel } from "./public/summary-model.js";
import { demoRecords } from "./scripts/demo-records.js";

test("chart period preserves the factor and fixed 30-day recommendations", () => {
  const records = demoRecords("2026-10-04");
  const month = summaryModel(records, "2026-10-04", { factor: "screen" });
  const week = summaryModel(records, "2026-10-04", { period: "7", factor: "screen" });
  const custom = summaryModel(records, "2026-10-04", {
    period: "custom", start: "2026-09-08", end: "2026-09-15", factor: "screen",
  });
  assert.equal(month.selected, "screen");
  assert.equal(week.selected, "screen");
  assert.equal(week.rows.length, 7);
  assert.equal(month.rows.length, 30);
  assert.deepEqual(week.results, month.results);
  assert.deepEqual(custom.results, month.results);
});

test("missing observations do not extend or fabricate the analysis window", () => {
  const records = demoRecords("2026-10-04").filter((_, index) => index % 3 !== 0);
  records.push({ date: "2026-09-04", exercise: 50, sleep: 20 });
  const model = summaryModel(records, "2026-10-04");
  assert.equal(model.analysisStart, "2026-09-05");
  assert.equal(model.analysisEnd, "2026-10-04");
  assert.equal(model.rows.length, 20);
  assert.ok(model.results.every(result => result.n <= 20));
});
