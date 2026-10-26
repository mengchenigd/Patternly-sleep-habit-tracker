import { addDays, dateInZone } from "./dates.js";

export function cycleEnd(goal) {
  return addDays(goal.start_date, goal.duration_days - 1);
}

export function unfinishedGoal(goals, currentDate, checkins = []) {
  return goals.find(goal => {
    if (goal.ended_at || cycleEnd(goal) < currentDate) return false;
    const completedToday = cycleEnd(goal) === currentDate && checkins.some(check =>
      check.goal_id === goal.id && check.date === currentDate && check.met);
    return !completedToday;
  }) || null;
}

export function endedDate(goal, timeZone = "UTC") {
  return goal.ended_date || (goal.ended_at ? dateInZone(timeZone, new Date(goal.ended_at)) : null);
}

export function selectGoal(goals, currentDate, selectedId = null) {
  const selected = goals.find(goal => goal.id === selectedId);
  if (selected) return selected;
  return goals.find(goal => !goal.ended_at && goal.start_date <= currentDate && cycleEnd(goal) >= currentDate)
    || [...goals].filter(goal => goal.start_date <= currentDate)
      .sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
    || [...goals].filter(goal => !goal.ended_at && goal.start_date > currentDate)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
    || goals[0] || null;
}

export function nextAvailableStart(goals, currentDate) {
  let start = currentDate;
  const chronological = [...goals].sort((a, b) => a.start_date.localeCompare(b.start_date));
  for (const goal of chronological) {
    const end = goal.ended_at ? addDays(endedDate(goal), -1) : cycleEnd(goal);
    if (goal.start_date <= start && end >= start) start = addDays(end, 1);
  }
  return start;
}
