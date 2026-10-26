import { escape } from "./html.js";

export function renderAdminTables(target, tables) {
  target.replaceChildren();
  for (const [name, rows] of Object.entries(tables)) {
    const section = document.createElement("section");
    const heading = document.createElement("h3");
    heading.textContent = `${name} · ${rows.length} rows`;
    section.append(heading);
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    if (!rows.length) wrap.textContent = "No saved rows yet.";
    else {
      const table = document.createElement("table");
      const columns = Object.keys(rows[0]);
      table.innerHTML = `<thead><tr>${columns.map(column => `<th>${escape(column)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(row => `<tr>${columns.map(column => `<td>${escape(row[column])}</td>`).join("")}</tr>`).join("")}</tbody>`;
      wrap.append(table);
    }
    section.append(wrap);
    target.append(section);
  }
}

export function exportAdminData(tables) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(tables, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "patternly-admin-data.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
