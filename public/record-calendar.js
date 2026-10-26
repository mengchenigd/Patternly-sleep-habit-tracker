// Pure calendar markup; selection and navigation stay in the controller.
export function recordCalendar({ month, records, selectedDate, currentDate }) {
  const first = `${month}-01`;
  const start = new Date(first + "T12:00:00");
  const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const recorded = new Set(records.map(r => r.date));
  const title = start.toLocaleDateString("en-US", {month:"long", year:"numeric"});
  let cells = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => `<span class="record-date-weekday">${d}</span>`).join("");
  cells += '<span aria-hidden="true"></span>'.repeat(start.getDay());
  for (let day = 1; day <= days; day++) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const saved = recorded.has(date);
    cells += `<button type="button" class="record-date-day ${saved ? "has-record" : ""}" data-action="record-date:${date}" aria-label="${date} · ${saved ? "Recorded" : "No record"}" aria-pressed="${date === selectedDate}" ${date > currentDate ? "disabled" : ""}>${day}</button>`;
  }
  const content = `<div class="record-date-header"><button type="button" data-action="record-month:prev" aria-label="Previous month">‹</button><h2 id="popup-title">${title}</h2><button type="button" data-action="record-month:next" aria-label="Next month" ${month >= currentDate.slice(0, 7) ? "disabled" : ""}>›</button></div><div class="record-date-grid">${cells}</div>`;
  return content;
}
