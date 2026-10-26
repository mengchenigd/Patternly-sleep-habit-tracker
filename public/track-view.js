import { addDays } from "./dates.js";
import { cycleEnd, endedDate, unfinishedGoal } from "./goal-cycle.js";
import { weeklySleepDuration, weeklySleepQuality } from "./goal-progress.js";
import { button } from "./forms-view.js";

export function trackProgress(goal, checkins, selectedDate, currentDate) {
  const checks = checkins.filter(check => check.goal_id === goal.id);
  const met = checks.filter(check => check.met).length;
  const progressDate = endedDate(goal) || currentDate;
  const elapsed = Math.max(0, Math.min(goal.duration_days,
    Math.floor((Date.parse(progressDate) - Date.parse(goal.start_date)) / 86400000) + 1));
  const days = Array.from({ length: goal.duration_days }, (_, index) => {
    const date = addDays(goal.start_date, index);
    const check = checks.find(check => check.date === date);
    const status = check ? check.met ? "Goal met" : "Not met" : "Not recorded";
    const className = [date === selectedDate ? "selected" : "", check?.met ? "met" : check ? "not-met" : ""].join(" ");
    return `<button type="button" data-action="day:${date}" title="${date} · ${status}"
      aria-label="${date} · ${status}" aria-pressed="${date === selectedDate}" class="${className}"
      ${date > currentDate || goal.ended_at ? "disabled" : ""}>${date === currentDate ? "Today" : Number(date.slice(8))}</button>`;
  }).join("");
  return `<section class="card track-progress">
    <p class="eyebrow">YOUR PROGRESS</p>
    <div class="progress-heading"><strong>Day ${elapsed} of ${goal.duration_days}</strong>
      <span aria-label="${met} of ${goal.duration_days} days met">${Math.round(met / goal.duration_days * 100)}%</span></div>
    <p class="subtitle">${goal.start_date} — ${cycleEnd(goal)}</p>
    <div class="days" role="group" aria-label="Select a check-in date">${days}</div>
  </section>`;
}

function trackQualitySummary(goal, records, currentDate) {
  const weeks = weeklySleepQuality(records, goal, currentDate);
  const average = rows => {
    const values = rows.map(row => row.value).filter(value => value !== null);
    return values.length ? `${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)} / 5` : "No ratings yet";
  };
  const dates = rows => `${rows[0].date.slice(5)}–${rows.at(-1).date.slice(5)}`;
  return `<div><p class="eyebrow">AVERAGE SLEEP QUALITY</p>
    <div class="sleep-week-legend">
      <span class="current-week">This week · ${dates(weeks.current)}<br><strong>${average(weeks.current)}</strong></span>
      <span class="previous-week">Previous week · ${dates(weeks.previous)}<br><strong>${average(weeks.previous)}</strong></span>
    </div></div>`;
}

function sleepDurationChart(weeks) {
  const width = 310, height = 185, left = 25, right = 12, top = 15, bottom = 30;
  const x = index => left + index * (width - left - right) / 6;
  const maximum = Math.max(10, ...[...weeks.current, ...weeks.previous].map(row => row.value ?? 0));
  const ceiling = Math.ceil(maximum / 4) * 4;
  const y = value => height - bottom - value * (height - top - bottom) / ceiling;
  const grid = Array.from({ length: 5 }, (_, index) => index * ceiling / 4).map(value => `
    <line x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}" stroke="#e4d7c9"/>
    <text x="15" y="${y(value) + 4}" text-anchor="end">${value}</text>`).join("");
  const series = (rows, color, dashed) => rows.map((row, index) => {
    if (row.value === null) return "";
    const previous = rows[index - 1];
    const line = previous?.value != null ? `
      <line x1="${x(index - 1)}" y1="${y(previous.value)}" x2="${x(index)}" y2="${y(row.value)}"
        stroke="${color}" stroke-width="2.5" ${dashed ? 'stroke-dasharray="5 4"' : ""}/>` : "";
    return `${line}<circle cx="${x(index)}" cy="${y(row.value)}" r="4" fill="${color}">
      <title>${row.date}: ${row.value} hours</title></circle>`;
  }).join("");
  const labels = weeks.current.map((_, index) =>
    `<text x="${x(index)}" y="${height - 10}" text-anchor="middle">${index + 1}</text>`).join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img"
    aria-label="Sleep duration in hours: this goal week compared with the previous week" class="sleep-quality-chart">
    <g font-size="10" fill="#705b50">${grid}${series(weeks.previous, "#9c8d7d", true)}${series(weeks.current, "#513c71", false)}${labels}</g>
  </svg>`;
}

export function trackReview(goal, records, checkins, selectedDate, currentDate) {
  const weeks = weeklySleepDuration(records, goal, currentDate);
  const dates = rows => `${rows[0].date.slice(5)}–${rows.at(-1).date.slice(5)}`;
  return `${goal.ended_at ? trackProgress(goal, checkins, selectedDate, currentDate) : ""}
    <section class="card">
      ${trackQualitySummary(goal, records, currentDate)}
      <p class="eyebrow">SLEEP DURATION · HOURS</p>
      <div class="sleep-week-legend">
        <span class="current-week">● This week · ${dates(weeks.current)}</span>
        <span class="previous-week">┄ Previous week · ${dates(weeks.previous)}</span>
      </div>
      ${sleepDurationChart(weeks)}
      <p class="subtitle">Days 1–7 · sleep on each night</p>
    </section>
    ${unfinishedGoal([goal], currentDate, checkins) ? "" : `<div class="row">${button("Start next cycle", "next-cycle", "primary")}</div>`}`;
}
