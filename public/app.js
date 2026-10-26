import { welcomeMarkup, profileMarkup, profileForm } from "./profile-view.js";
import { button, recordForm, goalForm } from "./forms-view.js";
import { trackProgress, trackReview } from "./track-view.js";
import { enhanceFields } from "./form-controls.js";
import { recordCalendar } from "./record-calendar.js";
import { addDays, dateInZone } from "./dates.js";
import { escape } from "./html.js";
import { renderSummaryChart } from "./summary-chart.js";
import { summaryMarkup, patternMarkup } from "./summary-view.js";
import {
  completesCycleOnCheckIn,
  giveUpMessage,
} from "./goal-progress.js";
import { FACTORS, summaryModel } from "./summary-model.js";
import { endedDate, unfinishedGoal } from "./goal-cycle.js";
import { exportAdminData, renderAdminTables } from "./admin-view.js";
// Plain JavaScript UI. All persistent data goes through the API in server.js.
const $ = (s) => document.querySelector(s);
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const today = () => dateInZone(timeZone);
let view = "app",
  profileDraft = {},
  profileEditing = false;
let data = { profiles: [], records: [], goals: [], checkins: [] },
  stage = 0,
  habit = "Caffeine",
  recordDate = today(),
  checkDate = today(),
  busy = false;
let adminData = {};
let editingGoalId = null;
let signedInUser = null;
let inviteRequired = false;
let authMode = "login";
let tutorialStep = 0;
let suggestedGoal = null;
let recordCalendarMonth = today().slice(0, 7);
const stages = ["Record", "Summary", "Plan", "Track"];

const titles = [
  "How was<br>your day?",
  "What would you<br>like to focus on?",
  "One small goal.<br>Your own pace.",
  "A small step,<br>every day.",
  "Look back.<br>Move forward.",
];
const currentGoal = () => stage === 3
  ? unfinishedGoal(data.goals, today(), data.checkins)
  : data.goals.find(goal => goal.id === editingGoalId) || data.goals.find(goal => goal.habit === habit);

const record = () => data.records.find((r) => r.date === recordDate);
function notice(message) {
  $("#status").textContent = message;
  clearTimeout(notice.timer);
  notice.timer = setTimeout(() => ($("#status").textContent = ""), 5000);
}
async function api(route, body) {
  const response = await fetch(
    "/api/" + route,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Time-Zone": timeZone },
          body: JSON.stringify(body),
        }
      : {},
  );
  const result = await response.json();
  if (response.status === 401 && !route.startsWith("auth/")) {
    clearAccount();
    render();
  }
  if (!response.ok) throw Error(result.error);
  return result;
}
async function save(route, body, next = stage) {
  if (busy) return;
  busy = true;
  try {
    data = await api(route, body);
    stage = next;
    if (route === "records") view = "summary";
    if (route === "goals" || route === "goals/update") {
      editingGoalId = null;
      suggestedGoal = null;
    }
    render();
    notice("Saved");
    return true;
  } catch (e) {
    notice(e.message);
    return false;
  } finally {
    busy = false;
  }
}
function go(n) {
  if (!data.profiles?.length) return;
  view = n === 1 ? "summary" : "app";
  stage = n === 4 ? 3 : n;
  if (stage === 3 && !currentGoal() && data.goals.length) habit = data.goals[0].habit;
  render();
}
function render() {
  $("#account-logout").hidden = !signedInUser;
  if (!signedInUser?.is_admin) {
    $("#database").hidden = true;
    $("#tables").replaceChildren();
  }
  if (!signedInUser) {
    renderAuth();
    return;
  }
  if (signedInUser.is_admin) {
    renderAdmin();
    return;
  }
  if (view === "tutorial") {
    const tutorial = tutorialSteps[tutorialStep];
    const savedStage = stage;
    view = tutorial.view;
    stage = tutorial.stage;
    render();
    view = "tutorial";
    stage = savedStage;
    renderTutorial();
    return;
  }
  if (!data.profiles?.length && view === "app") view = "welcome";
  if (view === "summary") {
    renderSummary();
    return;
  }
  if (view !== "app") {
    renderProfile();
    return;
  }
  $("#steps").innerHTML = navigation();
  const g = currentGoal(),
    r = record() || {};
  if (stage === 3 && g) habit = g.habit;
  const editingGoal = data.goals.find(goal => goal.id === editingGoalId);
  let html = `<p class="eyebrow">0${stage + 1} / ${stage < 2 ? stages[stage] : escape(habit) + " · " + stages[stage]}</p><h2 tabindex="-1">${titles[stage]}</h2>`;
  if (stage === 0) {
    html = `<button type="button" class="record-calendar record-calendar-button"
      data-action="record-calendar" aria-label="Choose record date" title="Choose record date">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/>
        <path d="M7 3v5M17 3v5M3 11h18"/></svg></button>` + html;
    html += recordForm(r, recordDate);
  } else if (stage === 2) {
    const unfinished = unfinishedGoal(data.goals, today(), data.checkins);
    if (!editingGoal && unfinished) {
      html += `<section class="card"><p>You already have a goal. Give it up or complete the cycle before creating a new one.</p>
        ${button("View current goal", "stage:3", "primary")}</section>`;
    } else {
      html += goalForm({ habit, editingGoal, suggestion: suggestedGoal, currentDate: today() });
    }
  } else if (!g) {
    html += `<section class="card"><p>No ongoing goal. Choose one to get started.</p>${button("Create a goal", "stage:2", "primary")}</section>`;
  } else if (stage === 3) {
    const checks = data.checkins.filter((c) => c.goal_id === g.id);
    if (
      checkDate < g.start_date ||
      checkDate > addDays(g.start_date, g.duration_days - 1)
    )
      checkDate = g.start_date;
    const selected = checks.find((c) => c.date === checkDate);
    html += `<section class="card"><p class="eyebrow">MY GOAL</p><strong>${escape(g.goal)}</strong></section>
      ${trackProgress(g, data.checkins, checkDate, today())}
      <button data-action="check:yes" class="primary check-in" ${checkDate > today() ? "disabled" : ""}
        aria-pressed="${Boolean(selected?.met)}" title="${selected?.met ? "Cancel check-in" : "Check in"}">
        ${selected?.met ? "Checked in ✓" : "Check in"}</button>
      `;
  }
  if (stage === 3 && g) {
    html += trackReview(g, data.records, data.checkins, checkDate, today());
    html += button("Give up goal", "give-up", "give-up");
  }
  if (stage > 0)
    html += button("‹ Back", "stage:" + Math.max(0, stage - 1), "text-button");
  $("#screen").innerHTML = html;
  enhanceFields();
  renderDatabase();
  $("#record-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.target));
    for (const k of ["caffeine", "exercise", "screen", "mood"])
      b[k] = Number(b[k]);
    b.sleep = b.sleep === "" ? null : Number(b.sleep);
    b.water = b.water === "" ? null : Number(b.water);
    b.sleep_quality = b.sleep_quality ? Number(b.sleep_quality) : null;
    recordDate = b.date;
    save("records", b, 1);
  });
  $("#goal-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.target));
    b.duration_days = Number(b.duration_days);
    checkDate = b.start_date;
    habit = b.habit;
    if (editingGoalId) b.goal_id = editingGoalId;
    save(editingGoalId ? "goals/update" : "goals", b, 3);
  });

}
function popup(html) {
  $("#popup-content").innerHTML = html;
  $("#popup").showModal();
}
function showCycleCompletePopup(goal) {
  popup(
    `<div class="cycle-complete-icon" aria-hidden="true">✦</div>
     <p class="eyebrow">CYCLE COMPLETE</p>
     <h2 id="popup-title">Congratulations!</h2>
     <p>You completed your ${goal.duration_days}-day goal: <strong>${escape(goal.goal)}</strong></p>
     <div class="row">${button("Set a new goal", "new-goal", "primary")}${button("Close", "close-popup")}</div>`,
  );
}
function showRecordCalendar() {
  const content = recordCalendar({
    month: recordCalendarMonth,
    records: data.records,
    selectedDate: recordDate,
    currentDate: today(),
  });
  if ($("#popup").open) $("#popup-content").innerHTML = content;
  else popup(content);
}
function renderAdmin() {
  $("#steps").replaceChildren();
  $("#menu").hidden = true;
  $("#screen").innerHTML = `
    <p class="eyebrow">ADMINISTRATION</p><h2>Data overview.</h2>
    <p>View saved accounts, records, goals and check-ins.</p>`;
  $("#database").hidden = false;
  refreshAdmin();
}

async function refreshAdmin() {
  if (!signedInUser?.is_admin) return;
  const adminId = signedInUser.id;
  try {
    const result = await api("admin/database");
    if (signedInUser?.is_admin && signedInUser.id === adminId) {
      adminData = result;
      renderDatabase();
    }
  } catch (error) {
    notice(error.message);
  }
}

function renderDatabase() {
  if (!signedInUser?.is_admin || $("#database").hidden) return;
  renderAdminTables($("#tables"), adminData);
}

document.addEventListener("click", async (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (!action || busy || !signedInUser) return;
  const [name, value] = action.split(":");
  if (name === "logout") {
    try {
      await api("auth/logout", {});
      clearAccount();
      render();
    } catch (error) {
      notice(error.message);
    }
    return;
  }
  if (name === "close-popup") {
    $("#popup").close();
  } else if (name === "record-calendar") {
    recordCalendarMonth = recordDate.slice(0, 7);
    showRecordCalendar();
  } else if (name === "record-month") {
    const d = new Date(`${recordCalendarMonth}-01T12:00:00`);
    d.setMonth(d.getMonth() + (value === "prev" ? -1 : 1));
    const month = d.toLocaleDateString("en-CA").slice(0, 7);
    if (month > today().slice(0, 7)) return;
    recordCalendarMonth = month;
    showRecordCalendar();
  } else if (name === "record-date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today()) return;
    recordDate = value;
    $("#popup").close();
    render();
  } else if (name === "onboard") {
    view = "profile-basics";
    render();
  } else if (name === "welcome") {
    view = "welcome";
    render();
  } else if (name === "tutorial-next") {
    tutorialStep = Math.min(tutorialStep + 1, tutorialSteps.length - 1);
    render();
  } else if (name === "tutorial-previous") {
    tutorialStep = Math.max(tutorialStep - 1, 0);
    render();
  } else if (name === "tutorial-replay") {
    tutorialStep = 0;
    stage = 0;
    view = "tutorial";
    render();
  } else if (name === "tutorial-finish" || name === "tutorial-skip") {
    try {
      const result = await api("auth/tutorial-complete", {});
      signedInUser = result.user;
      tutorialStep = 0;
      view = "app";
      render();
    } catch (error) {
      notice(error.message);
    }
  } else if (name === "edit-profile") {
    profileEditing = true;
    render();
  } else if (name === "cancel-profile") {
    profileEditing = false;
    render();
  } else if (name === "analysis-tab") {
    analysisTab = value;
    renderSummary();
    $(".pattern-tabs button[aria-pressed=true]")?.focus({preventScroll:true});
  } else if (name === "adopt") {
    const suggestion = visibleSuggestions[Number(value)];
    if (!suggestion) return;
    editingGoalId = null;
    suggestedGoal = { ...suggestion };
    habit = suggestion.habit;
    go(2);
    notice(
      "Suggestion added",
    );
  } else if (name === "summary") {
    if (!data.profiles?.length) return;
    $("#popup").close();
    view = "summary";
    render();
  } else if (name === "settings") {
    if (!data.profiles?.length) return;
    $("#popup").close();
    view = "settings";
    profileEditing = false;
    render();
  } else if (name === "stage") {
    if (Number(value) === 2) editingGoalId = null;
    $("#popup").close();
    go(Number(value));
  } else if (name === "own-goal") {
    editingGoalId = null;
    habit = "Other";
    suggestedGoal = { habit, goal: "" };
    go(2);
  } else if (name === "day") {
    checkDate = value;
    render();
  } else if (name === "give-up") {
    const g = currentGoal();
    if (!g || g.ended_at) return;
    popup(`<h2 id="popup-title">${giveUpMessage(g.start_date, today())}</h2>
      <p>Giving up will end this cycle. Your saved check-ins will remain available.</p>
      <div class="row">${button("Keep going", "keep-going", "primary")}
        ${button("Yes, give up", "confirm-give-up:" + g.id)}</div>`);
  } else if (name === "keep-going") {
    $("#popup").close();
  } else if (name === "confirm-give-up") {
    if (busy) return;
    busy = true;
    try {
      data = await api("goals/give-up", {goal_id: Number(value)});
      $("#popup").close();
      render();
      notice("Cycle ended. Your check-ins are saved.");
    } catch (error) {
      notice(error.message);
    } finally {
      busy = false;
    }
  } else if (name === "check") {
    const goal = currentGoal();
    if (!goal || goal.ended_at || checkDate > today()) return;
    if (data.checkins.some(c => c.goal_id === goal.id && c.date === checkDate && c.met)) {
      await save("checkins/cancel", {goal_id: goal.id, date: checkDate});
      return;
    }
    const completedCycle = completesCycleOnCheckIn(goal, checkDate, value === "yes");
    const saved = await save("checkins", {
      goal_id: currentGoal().id,
      date: checkDate,
      met: value === "yes",
    });
    if (saved && completedCycle) showCycleCompletePopup(goal);
  } else if (name === "new-goal") {
    $("#popup").close();
    editingGoalId = null;
    habit = currentGoal()?.habit || habit;
    suggestedGoal = null;
    go(2);
  } else if (name === "next-cycle") {
    if (busy) return;
    busy = true;
    try {
      const g = currentGoal();
      if (name === "next-cycle") {
        if (unfinishedGoal(data.goals, today(), data.checkins)) {
          notice("Give up your current goal or complete the cycle before creating a new one.");
          return;
        }
        const start = [today(), endedDate(g) || addDays(g.start_date, g.duration_days)]
          .sort()
          .at(-1);
        data = await api("goals", {
          habit,
          goal: g.goal,
          duration_days: g.duration_days,
          start_date: start,
        });
        checkDate = today();
        stage = 3;
      }
      render();
      if (name === "next-cycle") notice("Cycle created");
    } catch (err) {
      notice(err.message);
    } finally {
      busy = false;
    }
  }
});
$("#menu").onclick = () => {
  if (!signedInUser || !data.profiles?.length) return;
  popup(`<h2 id="popup-title">Your pages</h2>${navigation()}`);
};
$("#close-popup").onclick = () => $("#popup").close();
$("#refresh").onclick = refreshAdmin;
$("#export").onclick = () => {
  if (signedInUser?.is_admin) exportAdminData(adminData);
};

function renderProfile() {
  const saved = data.profiles?.[0];
  const profile = {
    name: "",
    age_range: "Prefer not to say",
    schedule: "Regular daytime",
    bedtime: "22:30",
    wake_time: "07:00",
    sleep_target: 8,
    ...(saved || profileDraft),
  };
  $("#steps").innerHTML = saved ? navigation() : "";
  $("#menu").hidden = !saved;
  let html;
  if (view === "welcome") html = welcomeMarkup();
  else if (view === "settings" && !profileEditing) {
    html = profileMarkup(profile, privacyClaim() + disclaimerClaim());
  } else {
    html = profileForm(profile, { saved: Boolean(saved), basics: view === "profile-basics" });
  }
  $("#screen").innerHTML = html;
  enhanceFields();
  renderDatabase();
  $("#profile-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.target));
    if (view === "profile-basics") {
      profileDraft = { ...profile, ...values };
      view = "profile-rhythm";
      render();
      return;
    }
    if (busy) return;
    busy = true;
    try {
      const body = { ...profile, ...values };
      body.sleep_target = Number(body.sleep_target);
      data = await api("profile", body);
      view = saved ? "settings" : "app";
      profileEditing = false;
      $("#menu").hidden = false;
      render();
      notice("Profile saved");
    } catch (err) {
      notice(err.message);
    } finally {
      busy = false;
    }
  });
}

let historyRange = "30";
let historyStart = "";
let historyEnd = "";
function renderSummary() {
  $("#steps").innerHTML = navigation();
  const model = summaryModel(data.records, today(), {
    period: historyRange, start: historyStart, end: historyEnd, factor: analysisTab,
  });
  const { chartStart: start, chartEnd: end, rows, selected } = model;
  analysisTab = selected;
  $("#screen").innerHTML = summaryMarkup(model, historyRange);
  const factor = FACTORS[selected];
  renderSummaryChart($("#trend-chart"), {
    rows, start, end, series: [selected, factor.label, factor.unit, factor.color],
  });
  const pattern = patternMarkup(model);
  visibleSuggestions = pattern.suggestions;
  $("#screen").insertAdjacentHTML("beforeend", pattern.html);
  $("#history-range").onchange = event => {
    historyRange = event.target.value;
    renderSummary();
  };
  for (const [id, update] of [
    ["history-start", value => { historyStart = value; }],
    ["history-end", value => { historyEnd = value; }],
  ]) {
    $("#" + id)?.addEventListener("change", event => {
      update(event.target.value);
      renderSummary();
    });
  }
  renderDatabase();
}

function navigation() {
  return [
    ["Record", "stage:0"],
    ["Summary", "summary"],
    ["Plan", "stage:2"],
    ["Track", "stage:3"],
    ["Settings", "settings"],
  ]
    .map(([name, action]) =>
      button(
        name,
        action,
        (view === "app" && action === "stage:" + stage) || view === action
          ? "active"
          : "",
      ),
    )
    .join("");
}
function privacyClaim() {
  return `<details class="settings-info privacy-card">
    <summary><span class="settings-mark" aria-hidden="true">◌</span>
      <span><span class="eyebrow">PRIVACY</span><strong>Your data stays yours.</strong></span>
      <span class="settings-chevron" aria-hidden="true">⌄</span></summary>
    <div class="settings-info-body">
      <p>We use what you record only to provide your Patternly history, charts and sleep insights.</p>
      <ul><li>We do not sell your data or use it for advertising.</li>
        <li>We do not send your habit data to an AI service.</li>
        <li>Authorized administrators can access saved records to manage this service.</li></ul>
      <p class="settings-note">Your records are kept separate from other accounts.
        This prototype does not yet support password recovery or account deletion;
        hosted records are not encrypted at rest.</p>
    </div>
  </details>`;
}

function disclaimerClaim() {
  return `<details class="settings-info disclaimer-card">
    <summary><span class="settings-mark" aria-hidden="true">i</span>
      <span><span class="eyebrow">ABOUT YOUR INSIGHTS</span><strong>Useful signals, not conclusions.</strong></span>
      <span class="settings-chevron" aria-hidden="true">⌄</span></summary>
    <div class="settings-info-body"><p>Patterns reflect associations in your recorded data.
      They do not prove a cause or provide medical advice.</p></div>
  </details>`;
}

let visibleSuggestions = [];
let analysisTab = null;
function clearAccount() {
  editingGoalId = null;
  signedInUser = null;
  data = { profiles: [], records: [], goals: [], checkins: [] };
  profileDraft = {};
  profileEditing = false;
  historyRange = "30";
  historyStart = "";
  historyEnd = "";
  suggestedGoal = null;
  visibleSuggestions = [];
  analysisTab = null;
  view = "app";
  stage = 0;
  habit = "Caffeine";
  recordDate = today();
  checkDate = today();
  tutorialStep = 0;
  adminData = {};
  $("#database").hidden = true;
  $("#tables").replaceChildren();
  $("#popup").close();
  $("#popup-content").replaceChildren();
}

function renderAuth() {
  $("#steps").replaceChildren();
  $("#menu").hidden = true;
  const register = authMode === "register";
  $("#screen").innerHTML = `
    <p class="eyebrow">YOUR PRIVATE PATTERNLY</p>
    <h2>${register ? "Create your account." : "Welcome back."}</h2>
    <form id="auth-form">
      <label>Account name<input name="username" required minlength="3" maxlength="32"
        pattern="[A-Za-z0-9_-]{3,32}" autocomplete="username" autocapitalize="none" spellcheck="false"></label>
      <label>Password<input name="password" type="password" required minlength="12" maxlength="128"
        autocomplete="${register ? "new-password" : "current-password"}"></label>
      ${register ? '<label>Confirm password<input name="confirm" type="password" required minlength="12" maxlength="128" autocomplete="new-password"></label>' : ""}
      ${register && inviteRequired ? '<label>Team invitation code<input name="invite_code" type="password" required autocomplete="off"></label>' : ""}
      <button class="primary">${register ? "Create account" : "Sign in"}</button>
    </form>
    <button id="switch-auth">${register ? "Already have an account? Sign in" : "New here? Create account"}</button>`;
  $("#switch-auth").onclick = () => {
    authMode = register ? "login" : "register";
    renderAuth();
  };
  $("#auth-form").onsubmit = async event => {
    event.preventDefault();
    if (busy) return;
    const body = Object.fromEntries(new FormData(event.target));
    if (register && body.password !== body.confirm) {
      notice("Passwords do not match.");
      return;
    }
    delete body.confirm;
    busy = true;
    $("#auth-form button").disabled = true;
    $("#switch-auth").disabled = true;
    try {
      const result = await api(register ? "auth/register" : "auth/login", body);
      signedInUser = result.user;
      data = signedInUser.is_admin ? data : await api("database");
      $("#menu").hidden = false;
      view = signedInUser.tutorial_completed_at ? "app" : "tutorial";
      render();
    } catch (error) {
      notice(error.message);
    } finally {
      busy = false;
      if ($("#auth-form button")) $("#auth-form button").disabled = false;
      if ($("#switch-auth")) $("#switch-auth").disabled = false;
    }
  };
}

const tutorialSteps = [
  {
    eyebrow: "QUICK DEMO · 1 OF 4",
    title: "Record one ordinary day.",
    copy: "Add sleep, caffeine, exercise and other habits. The morning reflection is a quick way to capture how you feel.",
    view: "app",
    stage: 0,
  },
  {
    eyebrow: "QUICK DEMO · 2 OF 4",
    title: "Review your patterns.",
    copy: "Summary turns saved days into a trend chart. It leaves gaps when there is no entry, so it never invents data.",
    view: "summary",
    stage: 1,
  },
  {
    eyebrow: "QUICK DEMO · 3 OF 4",
    title: "Set a small, personal goal.",
    copy: "Choose the habit, write the goal in your own words and choose a cycle length that works for you.",
    view: "app",
    stage: 2,
  },
  {
    eyebrow: "QUICK DEMO · 4 OF 4",
    title: "Check in as you go.",
    copy: "Track keeps your cycle in one place. A final-day check-in celebrates completion and lets you create a new goal.",
    view: "app",
    stage: 3,
  },
];
function renderTutorial() {
  const step = tutorialSteps[tutorialStep];
  const dots = tutorialSteps.map((_, index) =>
    `<span class="${index === tutorialStep ? "active" : ""}" aria-hidden="true"></span>`
  ).join("");
  const back = tutorialStep ? button("Back", "tutorial-previous") : button("Skip tutorial", "tutorial-skip");
  const next = tutorialStep === tutorialSteps.length - 1
    ? button("Start Patternly", "tutorial-finish", "primary")
    : button("Next", "tutorial-next", "primary");
  $("#screen").insertAdjacentHTML("beforeend", `
    <div class="tutorial-layer" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <section class="tutorial-card"><p class="eyebrow">${step.eyebrow}</p>
        <h2 id="tutorial-title">${step.title}</h2><p class="subtitle">${step.copy}</p>
        <div class="tutorial-dots" aria-label="Tutorial progress">${dots}</div>
        <div class="row">${back}${next}</div>
      </section>
    </div>`);
}

try {
  const session = await api("auth/session");
  signedInUser = session.user;
  inviteRequired = session.inviteRequired;
  if (signedInUser) {
    if (!signedInUser.is_admin) data = await api("database");
    view = signedInUser.tutorial_completed_at ? "app" : "tutorial";
  }
  render();
} catch (error) {
  clearAccount();
  render();
  notice("Could not connect: " + error.message);
}
