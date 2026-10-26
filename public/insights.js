import { addDays } from "./dates.js";

export const MIN_GROUP_SIZE = 3;
export const MIN_SLEEP_DIFFERENCE_HOURS = 1;
const FACTOR_KEYS = ["screen", "caffeine", "exercise", "water", "mood"];
const isFiniteNumber = value => typeof value === "number" && Number.isFinite(value);

function mean(group, field) {
  const values = group.map(pair => pair.next[field]).filter(isFiniteNumber);
  return {
    n: values.length,
    value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
  };
}

// Exploratory within-person comparisons; these do not establish causation.
// Habits on D pair with the night starting on D; morning mood follows D-1.
export function analyzeHistory(records, start, end) {
  const byDate = new Map(records.map(record => [record.date, record]));
  const days = [...byDate.values()].filter(record => record.date >= start && record.date <= end);
  const habitPairs = days.filter(day => isFiniteNumber(day.sleep)).map(day => ({ day, next: day }));
  const moodPairs = days.flatMap(day => {
    const night = byDate.get(addDays(day.date, -1));
    return night && night.date >= start && isFiniteNumber(night.sleep) ? [{ day, next: night }] : [];
  });

  return FACTOR_KEYS.map(key => {
    const source = key === "mood" ? moodPairs : habitPairs;
    const available = source.filter(pair => isFiniteNumber(pair.day[key]) &&
      (key !== "mood" || Number.isInteger(pair.day.mood) && pair.day.mood >= 1 && pair.day.mood <= 5));
    const sorted = available.map(pair => pair.day[key]).sort((a, b) => a - b);
    const threshold = sorted.length
      ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2
      : null;
    const low = available.filter(pair => pair.day[key] <= threshold);
    const high = available.filter(pair => pair.day[key] > threshold);
    const ready = low.length >= MIN_GROUP_SIZE && high.length >= MIN_GROUP_SIZE;
    const lowSleep = mean(low, "sleep");
    const highSleep = mean(high, "sleep");
    const difference = ready ? highSleep.value - lowSleep.value : null;
    let state = "association";
    if (available.length < MIN_GROUP_SIZE * 2) state = "insufficient";
    else if (!ready) state = "limited-variation";
    else if (Math.abs(difference) < MIN_SLEEP_DIFFERENCE_HOURS) state = "no-clear-difference";
    return {
      key, n: available.length, threshold,
      low: lowSleep, high: highSleep,
      qualityLow: mean(low, "sleep_quality"), qualityHigh: mean(high, "sleep_quality"),
      ready, difference, state,
    };
  });
}

export function strongestPattern(results) {
  return results.filter(result => result.key !== "mood" && result.state === "association")
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference) || b.n - a.n)[0] || null;
}
