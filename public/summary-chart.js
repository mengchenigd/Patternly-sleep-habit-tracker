import { escape } from "./html.js";

// Owns only the chart DOM; no account state or API calls.
export function renderSummaryChart(target, { rows, start, end, series }) {
  const [metric, metricLabel, metricUnit, metricColor] = series;
  if (start > end) target.textContent = "Choose an end date on or after the start date.";
  else if (!rows.length) target.textContent = "No entries in this period. Save a daily record to begin.";
  else {
    const days = Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;
    // Render only recorded groups; horizontal position still preserves calendar gaps.
    const w = Math.max(420, days * 48 + 90);
    const h = 285;
    const left = 40, right = 45, top = 28, bottom = 55;
    const plotH = h - top - bottom;
    const plotW = w - left - right;
    const sleepMax = Math.max(10, ...rows.map(r => r.sleep));
    const x=r=>left+((Date.parse(r.date)-Date.parse(start))/86400000+0.5)*plotW/days;
    const ySleep=v=>h-bottom-v/sleepMax*plotH;
    const metricMax = metric === "mood" ? 5 : Math.max(1, ...rows.map(r => r[metric] ?? 0));
    const grid = Array.from({ length: 5 }, (_, i) => {
      const y = h - bottom - i / 4 * plotH;
      return `<line x1="${left}" y1="${y}" x2="${w-right}" y2="${y}" stroke="#e4cbb2"/><text x="${left-7}" y="${y+4}" text-anchor="end">${Number((sleepMax*i/4).toFixed(1))}</text><text x="${w-right+7}" y="${y+4}" fill="${metricColor}">${Number((metricMax*i/4).toFixed(1))}</text>`;}).join("");
    const bars=rows.map(r=>{
      if (!Number.isFinite(r[metric])) return "";
      const height=r[metric]/metricMax*plotH;
      const tip=`${r.date} · ${metricLabel}: ${r[metric]} ${metricUnit}`;
      return `<rect tabindex="0" role="button" aria-label="${escape(tip)}" data-chart-tip="${escape(tip)}" x="${x(r)-10}" y="${h-bottom-Math.max(2,height)}" width="20" height="${Math.max(2,height)}" fill="${metricColor}" opacity="0.7" rx="3"/>`;
    }).join("");
    const line = rows.map((r, i) => {
      if (!Number.isFinite(r.sleep)) return `<text transform="translate(${x(r)},${h-bottom+16}) rotate(-40)" text-anchor="end">${r.date.slice(5)}</text>`;
      const prev = rows[i - 1];
      const tip = `${r.date} · Sleep: ${r.sleep} h · Night starting on this date`;
      return `${prev && Number.isFinite(prev.sleep) && Date.parse(r.date)-Date.parse(prev.date)===86400000?`<line x1="${x(prev)}" y1="${ySleep(prev.sleep)}" x2="${x(r)}" y2="${ySleep(r.sleep)}" stroke="#513c71" stroke-width="3"/>`:""}<circle tabindex="0" role="button" aria-label="${escape(tip)}" data-chart-tip="${escape(tip)}" cx="${x(r)}" cy="${ySleep(r.sleep)}" r="4" fill="#513c71" stroke="white"/><text transform="translate(${x(r)},${h-bottom+16}) rotate(-40)" text-anchor="end">${r.date.slice(5)}</text>`;}).join("");
    target.innerHTML=`<svg style="width:100%;min-width:${days > 7 ? w + 'px' : '0'}" viewBox="0 0 ${w} ${h}" role="group" aria-label="Sleep hours line and ${metricLabel} bars in ${metricUnit}"><g font-size="11" fill="#705b50"><text x="${left}" y="14">Sleep (h)</text><text x="${w-right}" y="14" text-anchor="end">${metricLabel} (${metricUnit})</text>${grid}${bars}${line}</g></svg>`;
    const tooltip = document.createElement("div");
    tooltip.className = "chart-tooltip";
    tooltip.setAttribute("role", "status");
    tooltip.hidden = true;
    target.after(tooltip);
    const showTip = e => {
      const point = e.target.closest("[data-chart-tip]");
      tooltip.hidden = !point;
      if (point) tooltip.textContent = point.dataset.chartTip;
    };
    target.addEventListener("pointerover", showTip);
    let pinnedTip = false;
    target.addEventListener("click", e => {
      pinnedTip = Boolean(e.target.closest("[data-chart-tip]"));
      showTip(e);
    });
    target.addEventListener("focusin", showTip);
    target.addEventListener("pointerleave", () => { if (!pinnedTip) tooltip.hidden = true; });
    target.addEventListener("focusout", () => { if (!pinnedTip) tooltip.hidden = true; });

  }
}
