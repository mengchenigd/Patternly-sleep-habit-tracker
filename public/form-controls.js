const $ = selector => document.querySelector(selector);
const today = () => dateInZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
import { addDays, dateInZone } from "./dates.js";

export function enhanceFields() {
  // Replace controls in place, so switching modes never discards other form values.
  $("#screen")
    .querySelectorAll("input:not([type=radio]),textarea")
    .forEach((original) => {
      if (original.type === "hidden" || original.name === "goal" || original.id === "record-calendar") return;
      const values = presets(original.name);
      if (!values) return;
      const name = original.name;
      const wrap = document.createElement("div");
      wrap.className = "editable-control";
      original.replaceWith(wrap);
      let control = original;
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "edit-control";
      toggle.setAttribute("aria-label", `Edit ${name.replaceAll("_", " ")}`);
      function dropdown() {
        const select = document.createElement("select");
        select.name = name;
        select.required = original.required;
        const options = [
          ...new Set([
            ...values.map(String),
            ...(control.value ? [control.value] : []),
          ]),
        ];
        select.add(new Option("Select…", ""));
        options.forEach((v) => select.add(new Option(v, v)));
        select.value = control.value;
        control = select;
        wrap.replaceChildren(select, toggle);
        toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5M4 15 15.5 3.5a2.1 2.1 0 0 1 3 0l2 2a2.1 2.1 0 0 1 0 3L9 20l-6 1z"/></svg>';
        toggle.title = `Edit ${name.replaceAll("_", " ")}`;
        toggle.setAttribute("aria-label", toggle.title);
        toggle.setAttribute("aria-pressed", "false");
      }
      toggle.onclick = () => {
        if (control.tagName === "SELECT") {
          original.value = control.value;
          control = original;
          wrap.replaceChildren(original, toggle);
          toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
          toggle.title = "Done";
          toggle.setAttribute("aria-label", `Done editing ${name.replaceAll("_", " ")}`);
          toggle.setAttribute("aria-pressed", "true");
          original.focus();
        } else {
          if (!control.checkValidity()) {
            control.reportValidity();
            return;
          }
          dropdown();
          control.focus();
        }
      };
      dropdown();
    });
}

// Presets are shortcuts, not recommendations. Custom values are retained as options.
const times = Array.from(
  { length: 48 },
  (_, i) =>
    `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
);
function presets(name) {
  return {
    duration_days: [3, 5, 7, 10, 14, 21, 30, 60, 90],
    caffeine: [0, 40, 80, 120, 160, 200, 300, 400],
    exercise: [0, 10, 15, 20, 30, 45, 60, 90, 120],
    screen: [0, 0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12],
    sleep: [4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10],
    bedtime: times,
    wake_time: times,
    sleep_target: [6, 6.5, 7, 7.5, 8, 8.5, 9, 10],
    date: Array.from({ length: 14 }, (_, i) => addDays(today(), -i)),
    start_date: Array.from({ length: 14 }, (_, i) => addDays(today(), i)),
  }[name];
}
