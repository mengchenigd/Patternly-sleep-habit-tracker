import { escape } from "./html.js";
import { FACTORS } from "./summary-model.js";
import { describePattern } from "./pattern-copy.js";

const format = value => Number(value).toFixed(1).replace(/\.0$/, "");
const actionButton = (label, action, className = "") =>
  `<button type="button" class="${className}" data-action="${action}">${label}</button>`;

export function summaryMarkup(model, period) {
  const { chartStart, chartEnd, rows, selected, recommended } = model;
  const periods = [["7", "Last 7 days"], ["30", "Last 30 days"], ["custom", "Custom dates"]];
  const options = periods.map(([value, label]) =>
    `<option value="${value}" ${period === value ? "selected" : ""}>${label}</option>`
  ).join("");
  const tabs = Object.entries(FACTORS).map(([key, factor]) => {
    const className = [selected === key ? "active" : "", recommended.has(key) ? "recommended" : ""].join(" ");
    return `<button type="button" data-action="analysis-tab:${key}" aria-pressed="${selected === key}"
      class="${className}" ${recommended.has(key) ? 'aria-description="Goal suggestion available"' : ""}>${factor.label}</button>`;
  }).join("");
  const customDates = period === "custom" ? `
    <div class="row">
      <label>From<input id="history-start" type="date" value="${escape(chartStart)}"></label>
      <label>To<input id="history-end" type="date" value="${escape(chartEnd)}"></label>
    </div>` : "";
  return `
    <p class="eyebrow">02 / SUMMARY</p>
    <h2>Your patterns,<br>over time.</h2>
    <label>Period<select id="history-range">${options}</select></label>
    ${customDates}
    <div class="pattern-tabs" role="group" aria-label="Chart and pattern categories">${tabs}</div>
    <section class="card combined-chart">
      <p class="eyebrow">DAILY HABITS & SLEEP</p>
      <div id="trend-chart"></div>
      <p class="subtitle">${escape(chartStart)} — ${escape(chartEnd)}</p>
    </section>`;
}

export function patternMarkup(model) {
  const { analysisStart, analysisEnd, selected, result } = model;
  const { label, unit, habit } = FACTORS[selected];
  const { message, goal } = describePattern(result);
  const comparison = result.state === "association" ? `
    <p class="eyebrow">${label} → SLEEP</p>
    <div class="pattern-comparison" aria-label="${label} sleep comparison">
      <div><small>AT OR BELOW ${format(result.threshold)} ${unit}</small>
        <strong>${format(result.low.value)} h</strong><small>average sleep</small></div>
      <div><small>ABOVE ${format(result.threshold)} ${unit}</small>
        <strong>${format(result.high.value)} h</strong><small>average sleep</small></div>
    </div>` : "";
  const suggestion = goal ? `
    <p class="eyebrow">TRY THIS</p><p>${escape(goal)}</p>
    ${actionButton("Use this suggestion", "adopt:0", "primary")}` : "";
  return {
    suggestions: goal ? [{ habit, goal }] : [],
    html: `<section class="history-analysis" data-start="${analysisStart}" data-end="${analysisEnd}">
      <h2>Pattern.</h2>
      <section class="card pattern-result" aria-live="polite">
        ${comparison}<p><strong>${escape(message)}</strong></p>${suggestion}
      </section>
      ${actionButton("Write my own goal", "own-goal", "primary")}
    </section>`,
  };
}
