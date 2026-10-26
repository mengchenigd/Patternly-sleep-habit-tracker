import { addDays } from "./dates.js";
import { cycleEnd, endedDate } from "./goal-cycle.js";

export function giveUpMessage(startDate, currentDate) {
  const day = Math.floor((Date.parse(currentDate) - Date.parse(startDate)) / 86400000) + 1;
  return day <= 2 ? "Just started! Are you sure?" : "Almost there! Are you sure?";
}

// Completion is triggered by a positive check-in on the final calendar day.
export function completesCycleOnCheckIn(goal, date, met) {
  return Boolean(met && goal && !goal.ended_at && date === cycleEnd(goal));
}

export function weeklySleepQuality(records, goal, currentDate) {
  return weeklySleep(records, goal, currentDate, "sleep_quality");
}

export function weeklySleepDuration(records, goal, currentDate) {
  return weeklySleep(records, goal, currentDate, "sleep");
}

export function averageSleepQuality(records, goal, currentDate) {
  const end = endedDate(goal);
  const last = [currentDate, cycleEnd(goal), ...(end ? [addDays(end, -1)] : [])].sort()[0];
  const values = records.filter(row => row.date >= goal.start_date && row.date <= last)
    .map(row => row.sleep_quality)
    .filter(value => Number.isInteger(value) && value >= 1 && value <= 5);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function weeklySleep(records, goal, currentDate, field) {
  const end = endedDate(goal);
  // Giving up releases that date for another goal; prior nights stay visible.
  const anchor = [currentDate, cycleEnd(goal), ...(end ? [addDays(end, -1)] : [])].sort()[0];
  const offset = Math.max(0, Math.floor((Date.parse(anchor) - Date.parse(goal.start_date)) / 86400000));
  const start = addDays(goal.start_date, Math.floor(offset / 7) * 7);
  const byDate = new Map(records.map(record => [record.date, record]));
  const week = weekStart => Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const value = byDate.get(date)?.[field];
    const available = date <= currentDate && date <= anchor
      && (field === "sleep" ? Number.isFinite(value) && value >= 0 && value <= 24
        : Number.isInteger(value) && value >= 1 && value <= 5);
    return { date, value: available ? value : null };
  });
  return { current: week(start), previous: week(addDays(start, -7)) };
}
