import { addDays } from "./dates.js";
import { analyzeHistory, strongestPattern } from "./insights.js";
import { describePattern } from "./pattern-copy.js";

export const ANALYSIS_DAYS = 30;
export const FACTORS = {
  exercise: { label: "Exercise", unit: "min", habit: "Exercise", color: "#638369" },
  caffeine: { label: "Caffeine", unit: "mg", habit: "Caffeine", color: "#a56543" },
  screen: { label: "Screen time", unit: "h", habit: "Screen time", color: "#b99b64" },
  water: { label: "Water intake", unit: "L", habit: "Water intake", color: "#6c99ac" },
  mood: { label: "Mood", unit: "points", habit: "Other", color: "#bd7991" },
};

// Chart dates never affect the rolling window used for recommendations.
export function summaryModel(records, currentDate, { period = "30", start, end, factor } = {}) {
  const analysisStart = addDays(currentDate, 1 - ANALYSIS_DAYS);
  const results = analyzeHistory(records, analysisStart, currentDate);
  const strongest = strongestPattern(results);
  const selected = Object.hasOwn(FACTORS, factor) ? factor : strongest?.key || "exercise";
  const chartEnd = period === "custom" ? end || currentDate : currentDate;
  const chartStart = period === "custom" ? start || addDays(chartEnd, -6) : addDays(chartEnd, 1 - Number(period));
  return {
    analysisStart, analysisEnd: currentDate, results, selected,
    result: results.find(result => result.key === selected),
    recommended: new Set(results.filter(result => describePattern(result).goal).map(result => result.key)),
    chartStart, chartEnd,
    rows: records.filter(record => record.date >= chartStart && record.date <= chartEnd)
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
