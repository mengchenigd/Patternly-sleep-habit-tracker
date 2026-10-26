import { escape } from "./html.js";
import { button, field, profileSelect } from "./forms-view.js";

const AGE_RANGES = ["Prefer not to say", "Under 18", "18–24", "25–34", "35–44", "45–54", "55–64", "65+"];
const SCHEDULES = ["Regular daytime", "Shift work", "Flexible", "Other"];

export function welcomeMarkup() {
  return `<p class="eyebrow">WELCOME TO PATTERNLY</p>
    <div class="welcome-mark">P</div><h2>Better sleep starts<br>with a small pattern.</h2>
    <section class="card"><strong>Make it yours</strong><p>Set your sleep target and start recording.</p></section>
    ${button("Get started", "onboard", "primary bottom")}`;
}

export function profileMarkup(profile, information) {
  const rows = [
    ["Name", profile.name], ["Age range", profile.age_range], ["Schedule", profile.schedule],
    ["Usual bedtime", profile.bedtime], ["Usual wake time", profile.wake_time],
    ["Sleep target", profile.sleep_target + " hours"],
  ].map(([label, value]) =>
    `<div class="profile-line"><span>${label}</span><strong>${escape(value)}</strong></div>`
  ).join("");
  return `<p class="eyebrow">SETTINGS / PERSONAL PROFILE</p><h2>Your profile.</h2>
    <section class="card">${rows}</section>
    ${button("Edit profile", "edit-profile", "primary")}
    ${button("View quick demo", "tutorial-replay")}${button("Sign out", "logout")}
    ${information}${button("Back to daily habits", "stage:0", "text-button")}`;
}

export function profileForm(profile, { saved, basics }) {
  const header = saved ? "SETTINGS / EDIT PROFILE" : basics ? "GETTING STARTED · 1 OF 2" : "GETTING STARTED · 2 OF 2";
  const title = basics ? "A little about you." : saved ? "Make it yours." : "Your usual rhythm.";
  const personalFields = basics || saved ? `
    ${field("Preferred name", "name", "text", profile.name, 'required maxlength="80" autocomplete="given-name"')}
    ${profileSelect("Age range (optional)", "age_range", AGE_RANGES, profile.age_range)}` : "";
  const sleepFields = !basics ? `
    ${profileSelect("Usual schedule", "schedule", SCHEDULES, profile.schedule)}
    ${field("Usual bedtime", "bedtime", "time", profile.bedtime, "required")}
    ${field("Usual wake time", "wake_time", "time", profile.wake_time, "required")}
    ${field("Sleep target · hours", "sleep_target", "number", profile.sleep_target, 'required min="0.1" max="24" step="0.1"')}` : "";
  return `<p class="eyebrow">${header}</p><h2>${title}</h2>
    <form id="profile-form">${personalFields}${sleepFields}
      <button class="primary bottom">${basics ? "Continue" : saved ? "Save profile" : "Finish setup"}</button>
      ${button(saved ? "Cancel" : "‹ Back", saved ? "cancel-profile" : basics ? "welcome" : "onboard", "text-button")}
    </form>`;
}
