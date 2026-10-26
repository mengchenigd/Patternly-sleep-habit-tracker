import { escape } from "./html.js";

export const button = (label, action, className = "") =>
  `<button type="button" class="${className}" data-action="${action}">${label}</button>`;

export const field = (label, name, type = "text", value = "", attributes = "") =>
  `<label>${label}<input name="${name}" type="${type}" value="${escape(value)}" ${attributes}></label>`;

export function profileSelect(label, name, options, selected) {
  const markup = options.map(value =>
    `<option ${value === selected ? "selected" : ""}>${escape(value)}</option>`
  ).join("");
  return `<label>${label}<select name="${name}" required>${markup}</select></label>`;
}

export function recordForm(record, date) {
  const qualityOptions = ["Very poor", "Poor", "Fair", "Good", "Very good"].map((label, index) =>
    `<option value="${index + 1}" ${record.sleep_quality === index + 1 ? "selected" : ""}>${index + 1} · ${label}</option>`
  ).join("");
  const exerciseTypes = ["", "None", "Walking", "Running", "Cycling", "Swimming", "Strength training", "Yoga", "Other"];
  if (record.exercise_type === "Not specified") exerciseTypes.push("Not specified");
  const moods = ["Sad", "Low", "Neutral", "Good", "Happy"].map((label, index) => `
    <label class="mood" title="${label}">
      <input type="radio" name="mood" value="${index + 1}" aria-label="${index + 1} · ${label}"
        required ${record.mood === index + 1 ? "checked" : ""}>
      <span class="face"><img src="/assets/face.svg" alt="">
        <img class="expression" src="/assets/mood${index + 1}.svg" alt=""></span>
      <span>${index + 1}</span>
    </label>`).join("");
  return `<form id="record-form">
    <input type="hidden" name="date" value="${date}">
    ${field("Sleep that night · hours", "sleep", "number", record.sleep ?? "", 'min="0" max="24" step="0.1"')}
    <label>Sleep quality that night<select name="sleep_quality">
      <option value="">Not recorded</option>${qualityOptions}
    </select></label>
    ${field("Caffeine · mg", "caffeine", "number", record.caffeine ?? "", 'min="0" max="3000" step="1" required')}
    <div class="record-exercise-row">
      ${profileSelect("Exercise type", "exercise_type", exerciseTypes, record.exercise_type || "")}
      ${field("Exercise · minutes", "exercise", "number", record.exercise ?? "", 'min="0" max="1440" step="1" required')}
    </div>
    ${field("Screen time · hours", "screen", "number", record.screen ?? "", 'min="0" max="24" step="0.1" required')}
    ${field("Water intake · L", "water", "number", record.water ?? "", 'min="0" max="20" step="0.01" placeholder="e.g. 1.75"')}
    <fieldset><legend>Morning reflection · How do you feel?</legend><div class="moods">${moods}</div></fieldset>
    <button class="primary bottom">Save &amp; see summary</button>
  </form>`;
}

export function goalForm({ habit, editingGoal, suggestion, currentDate }) {
  const goal = editingGoal?.goal || (suggestion?.habit === habit ? suggestion.goal : "");
  const duration = editingGoal?.duration_days || (suggestion?.goal ? 7 : "");
  const start = editingGoal?.start_date || currentDate;
  return `<form id="goal-form">
    ${profileSelect("Habit", "habit", ["Caffeine", "Exercise", "Screen time", "Water intake", "Other"], habit)}
    ${field("My sleep goal", "goal", "text", goal, 'required maxlength="200" placeholder="e.g. No caffeine after 2 PM"')}
    ${field("Cycle duration · days", "duration_days", "number", duration, 'required min="1" max="365" step="1"')}
    ${field("Cycle start date", "start_date", "date", start, "required")}
    <button class="primary bottom">${editingGoal ? "Save goal" : "Start my cycle"}</button>
  </form>`;
}
