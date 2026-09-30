// Excel Gantt task pane: reads the task table, schedules it (schedule.js), draws an
// interactive chart, and writes edits made on the chart back to the sheet.

import {
  HOUR,
  DAY,
  schedule,
  nowNaive,
  sequentialPredecessors,
  wouldCreateCycle,
  idOf,
  addPredecessor,
} from "./schedule.js";
import { ExcelSource, MemorySource, storage } from "./sources.js";
import { sampleRows, nextMondayMorning } from "./sample.js";

const $ = (id) => document.getElementById(id);
const chart = $("chart");
const ROW_H = 26;
const HEAD_H = 40;
const VIEW_KEY = "excel-gantt-view";
const MIN_PX = 0.4;
const MAX_PX = 96;

const view = { pxPerHour: 14, critical: false, links: true, namesW: 250, ...storage.get(VIEW_KEY) };
const saveView = () => storage.set(VIEW_KEY, view);

const state = {
  source: null,
  rows: [],
  settings: null,
  result: null,
  where: "",
  collapsed: new Set(), // task IDs
  selectedId: null,
  undo: [],
  range: { from: 0, to: 0 },
  visible: [],
};

const defaultSettings = () => ({
  projectStart: nextMondayMorning(),
  hoursPerDay: 24,
  shiftStart: 7,
  workDays: Array(7).fill(true),
});
function normalizeSettings(s) {
  const d = defaultSettings();
  const out = { ...d, ...(s || {}) };
  if (!Number.isFinite(out.projectStart)) out.projectStart = d.projectStart;
  if (!Array.isArray(out.workDays) || out.workDays.length !== 7) out.workDays = d.workDays;
  return out;
}

// ---------------------------------------------------------------------------------------
// formatting

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad2 = (n) => String(n).padStart(2, "0");
const md = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};
const fmtDate = (ms) => `${DOW[new Date(ms).getUTCDay()]} ${md(ms)}`;
const fmtTime = (ms) => {
  const d = new Date(ms);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
};
const fmtDT = (ms) => `${fmtDate(ms)} ${fmtTime(ms)}`;
const fmtHours = (h) => `${Math.round(h * 100) / 100} h`;
const toLocalInput = (ms) => (ms === null || ms === undefined ? "" : new Date(ms).toISOString().slice(0, 16));
const fromLocalInput = (v) => (v ? Date.parse(`${v}:00Z`) : null);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------------------
// colours (SVG is drawn with literal colours so the exported picture matches the screen)

const LIGHT = {
  bg: "#ffffff",
  bar: "#6f9fe3",
  barEdge: "#3f72c4",
  prog: "#2f5fa8",
  crit: "#ea7b72",
  critEdge: "#c0392b",
  critProg: "#9e2a1f",
  summary: "#2b2f36",
  link: "#7a848f",
  linkCrit: "#c0392b",
  grid: "#eef0f3",
  gridStrong: "#d3d8de",
  shade: "rgba(90,100,115,0.10)",
  text: "#1f2328",
  muted: "#5f6873",
  today: "#e0a100",
  sel: "#fff4d6",
  selEdge: "#e0a100",
};
const DARK = {
  ...LIGHT,
  bg: "#1b1d21",
  bar: "#4f86d6",
  barEdge: "#79a6ea",
  prog: "#a9c8f5",
  crit: "#d65b52",
  critEdge: "#ff8d80",
  critProg: "#ffc2bb",
  summary: "#dfe3e8",
  link: "#8b949e",
  linkCrit: "#ff8d80",
  grid: "#2a2d33",
  gridStrong: "#3c4148",
  shade: "rgba(255,255,255,0.05)",
  text: "#e7e9ec",
  muted: "#9aa3ad",
  sel: "#3a3322",
  selEdge: "#e8b73c",
};
const palette = () => (matchMedia("(prefers-color-scheme: dark)").matches ? DARK : LIGHT);

// ---------------------------------------------------------------------------------------
// layout helpers

/** The row that stands in for task i: itself, or its outermost collapsed ancestor. */
function representative(tasks, i) {
  let rep = i;
  for (let p = tasks[i].parent; p >= 0; p = tasks[p].parent) if (state.collapsed.has(tasks[p].id)) rep = p;
  return rep;
}

function computeRange(tasks, px, minWidth) {
  const floorTo = (ms, step) => Math.floor(ms / step) * step;
  const starts = tasks.map((t) => t.start);
  const ends = tasks.map((t) => t.finish);
  const lo = starts.length ? Math.min(...starts) : state.result.projectStart;
  const hi = ends.length ? Math.max(...ends) : lo + DAY;
  const from = floorTo(lo - HOUR, 6 * HOUR);
  let to = floorTo(hi + 3 * HOUR, 6 * HOUR) + 6 * HOUR;
  if (minWidth) to = Math.max(to, from + (minWidth / px) * HOUR);
  return { from, to, width: Math.ceil(((to - from) / HOUR) * px) };
}

function headerSvg({ from, to, width }, px, P) {
  const x = (ms) => ((ms - from) / HOUR) * px;
  const out = [`<rect width="${width}" height="${HEAD_H}" fill="${P.bg}"/>`];
  const text = (tx, ty, s, extra = "") =>
    `<text x="${tx}" y="${ty}" font-size="11" fill="${P.muted}" ${extra}>${esc(s)}</text>`;
  const vline = (vx, y1, y2, c) => `<line x1="${vx}" x2="${vx}" y1="${y1}" y2="${y2}" stroke="${c}"/>`;
  const dayPx = 24 * px;
  const firstDay = Math.floor(from / DAY) * DAY;

  if (dayPx >= 60) {
    // top: days, bottom: hours
    for (let d = firstDay; d < to; d += DAY) {
      const x0 = Math.max(0, x(d));
      const w = Math.min(width, x(d + DAY)) - x0;
      if (x(d) >= 0) out.push(vline(x(d), 0, HEAD_H, P.gridStrong));
      if (w > 28) {
        const dt = new Date(d);
        const label =
          w > 120 ? `${DOW[dt.getUTCDay()]} ${md(d)}/${String(dt.getUTCFullYear()).slice(2)}` : w > 62 ? fmtDate(d) : md(d);
        out.push(text(x0 + 5, 14, label, 'font-weight="600"'));
      }
    }
    const step = [1, 2, 3, 4, 6, 12].find((s) => s * px >= 28) ?? 24;
    for (let h = Math.ceil(from / (step * HOUR)) * step * HOUR; h < to; h += step * HOUR) {
      const hx = x(h);
      if (h % DAY !== 0) out.push(vline(hx, 22, HEAD_H, P.grid));
      out.push(text(hx + 3, 34, pad2(new Date(h).getUTCHours())));
    }
  } else {
    // top: weeks (from Monday), bottom: days
    let w0 = firstDay;
    while (new Date(w0).getUTCDay() !== 1) w0 -= DAY;
    for (let w = w0; w < to; w += 7 * DAY) {
      const x0 = Math.max(0, x(w));
      const wpx = Math.min(width, x(w + 7 * DAY)) - x0;
      if (x(w) >= 0) out.push(vline(x(w), 0, HEAD_H, P.gridStrong));
      if (wpx > 34) out.push(text(x0 + 5, 14, wpx > 80 ? `Week of ${md(w)}` : md(w), 'font-weight="600"'));
    }
    for (let d = firstDay; d < to; d += DAY) {
      const dx = x(d);
      if (dx >= 0) out.push(vline(dx, 22, HEAD_H, P.grid));
      const label = dayPx >= 34 ? `${DOW[new Date(d).getUTCDay()].slice(0, 2)} ${new Date(d).getUTCDate()}` : dayPx >= 15 ? String(new Date(d).getUTCDate()) : "";
      if (label && dx + 2 >= 0) out.push(text(dx + 3, 34, label));
    }
  }
  out.push(`<line x1="0" x2="${width}" y1="21.5" y2="21.5" stroke="${P.grid}"/>`);
  return out.join("");
}

function bodySvg(result, vis, { from, to, width }, px, P, { selectedIndex = -1, critical, links, markerPrefix = "m", interactive = true }) {
  const x = (ms) => ((ms - from) / HOUR) * px;
  const height = Math.max(vis.length * ROW_H, ROW_H);
  const rowOf = new Map(vis.map((t, r) => [t.index, r]));
  const cy = (r) => r * ROW_H + ROW_H / 2;
  const out = [`<rect width="${width}" height="${height}" fill="${P.bg}" data-bg="1"/>`];

  // non-working time, day lines, row lines
  for (const [a, b] of result.calendar.gaps(from, to)) {
    out.push(`<rect x="${x(a)}" y="0" width="${x(b) - x(a)}" height="${height}" fill="${P.shade}" pointer-events="none"/>`);
  }
  for (let d = Math.ceil(from / DAY) * DAY; d < to; d += DAY) {
    out.push(`<line x1="${x(d)}" x2="${x(d)}" y1="0" y2="${height}" stroke="${P.gridStrong}" pointer-events="none"/>`);
  }
  const selRow = rowOf.get(selectedIndex);
  if (selRow !== undefined) out.push(`<rect x="0" y="${selRow * ROW_H}" width="${width}" height="${ROW_H}" fill="${P.sel}" pointer-events="none"/>`);
  for (let r = 1; r <= vis.length; r++) {
    out.push(`<line x1="0" x2="${width}" y1="${r * ROW_H - 0.5}" y2="${r * ROW_H - 0.5}" stroke="${P.grid}" pointer-events="none"/>`);
  }
  const now = nowNaive();
  if (now > from && now < to) {
    out.push(`<line x1="${x(now)}" x2="${x(now)}" y1="0" y2="${height}" stroke="${P.today}" stroke-width="1.5" stroke-dasharray="4 3" pointer-events="none"/>`);
  }

  // dependency arrows
  out.push(
    `<defs>` +
      [
        [`${markerPrefix}-a`, P.link],
        [`${markerPrefix}-c`, P.linkCrit],
      ]
        .map(
          ([id, c]) =>
            `<marker id="${id}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0.5 L8,4 L0,7.5 z" fill="${c}"/></marker>`,
        )
        .join("") +
      `</defs>`,
  );
  if (links) {
    const seen = new Set();
    const T = result.tasks;
    for (const l of result.links) {
      const a = representative(T, l.from);
      const b = representative(T, l.to);
      const ra = rowOf.get(a);
      const rb = rowOf.get(b);
      if (a === b || ra === undefined || rb === undefined) continue;
      const key = `${a}>${b}:${l.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const ta = T[a];
      const tb = T[b];
      const y1 = cy(ra);
      const y2 = cy(rb);
      const down = y2 > y1 ? 1 : -1;
      let d;
      if (l.type === "SS") {
        const x1 = x(ta.start);
        const x2 = x(tb.start);
        d = `M${x1},${y1} H${Math.min(x1, x2) - 8} V${y2} H${x2 - 1}`;
      } else if (l.type === "FF") {
        const x1 = x(ta.finish);
        const x2 = x(tb.finish);
        d = `M${x1},${y1} H${Math.max(x1, x2) + 8} V${y2} H${x2 + 1}`;
      } else {
        const x1 = x(ta.finish);
        const x2 = x(tb.start);
        if (x2 >= x1 - 1) {
          const xm = Math.max(x1 + 5, x2 + 5);
          d = `M${x1},${y1} H${xm} V${y2 - down * 8}`;
        } else {
          d = `M${x1},${y1} H${x1 + 6} V${y1 + (down * ROW_H) / 2} H${x2 - 8} V${y2} H${x2 - 1}`;
        }
      }
      const crit = critical && ta.critical && tb.critical;
      out.push(
        `<path d="${d}" fill="none" stroke="${crit ? P.linkCrit : P.link}" stroke-width="1.1" marker-end="url(#${markerPrefix}-${crit ? "c" : "a"})" pointer-events="none"/>`,
      );
    }
  }

  // bars
  vis.forEach((t, r) => {
    const y = cy(r);
    const xs = x(t.start);
    const xf = x(t.finish);
    const crit = critical && t.critical;
    const sel = t.index === selectedIndex;
    const edge = sel ? P.selEdge : crit ? P.critEdge : P.barEdge;
    const sw = sel ? 2 : 1;
    const cls = `bar${t.isSummary ? " summary" : ""}${sel ? " sel" : ""}`;
    let g = "";
    let linkX;
    if (t.isSummary) {
      const fill = crit ? P.critEdge : P.summary;
      const w = Math.max(xf - xs, 6);
      g += `<rect data-role="select" x="${xs}" y="${y - 8}" width="${w}" height="16" fill="transparent"/>`;
      g += `<path class="body" data-role="select" d="M${xs},${y - 6} H${xs + w} V${y + 5} L${xs + w - 5},${y} H${xs + 5} L${xs},${y + 5} Z" fill="${fill}" stroke="${sel ? P.selEdge : "none"}" stroke-width="${sw}"/>`;
      linkX = xs + w + 9;
    } else if (t.duration === 0) {
      const fill = crit ? P.critEdge : P.summary;
      g += `<path class="body" data-role="move" d="M${xs},${y - 7} L${xs + 7},${y} L${xs},${y + 7} L${xs - 7},${y} Z" fill="${fill}" stroke="${sel ? P.selEdge : "none"}" stroke-width="${sw}"/>`;
      g += `<text x="${xs + 22}" y="${y + 4}" font-size="11" fill="${P.text}" pointer-events="none">${md(t.start)}</text>`;
      linkX = xs + 13;
    } else {
      const w = Math.max(xf - xs, 2);
      const fill = crit ? P.crit : P.bar;
      g += `<rect class="body" data-role="move" x="${xs}" y="${y - 6}" width="${w}" height="12" rx="2" fill="${fill}" stroke="${edge}" stroke-width="${sw}"/>`;
      if (t.pct > 0) {
        g += `<rect class="prog" data-role="move" x="${xs}" y="${y - 2}" width="${w * t.pct}" height="4" fill="${crit ? P.critProg : P.prog}"/>`;
      }
      if (w < 12) g += `<rect data-role="move" x="${xs - 4}" y="${y - 8}" width="${w + 8}" height="16" fill="transparent"/>`;
      // on short bars the handle sits mostly past the end so the bar itself stays draggable
      g += `<rect class="handle" data-role="resize" x="${xs + w - (w < 16 ? 1 : 4)}" y="${y - 8}" width="9" height="16" fill="transparent"/>`;
      linkX = xs + w + 11;
    }
    if (interactive) g += `<circle data-role="link" cx="${linkX}" cy="${y}" r="4.5" fill="${P.bg}" stroke="${P.barEdge}" stroke-width="1.5"/>`;
    out.push(`<g class="${cls}" data-i="${t.index}">${g}</g>`);
  });
  return { markup: out.join(""), height };
}

// ---------------------------------------------------------------------------------------
// render

/** The task list never takes more than ~55% of a narrow task pane. */
const namesWidth = () => Math.round(Math.min(view.namesW, Math.max(110, (chart.clientWidth || innerWidth) * 0.55)));

function render() {
  const r = state.result;
  $("empty").hidden = !!r;
  chart.hidden = !r;
  if (!r) {
    $("details").hidden = true;
    $("status").textContent = "";
    return;
  }
  const P = palette();
  const tasks = r.tasks;
  const vis = tasks.filter((t) => representative(tasks, t.index) === t.index);
  state.visible = vis;
  const selected = tasks.find((t) => t.id === state.selectedId);
  const selIndex = selected ? selected.index : -1;

  const namesW = namesWidth();
  chart.style.setProperty("--names-w", `${namesW}px`);
  const range = computeRange(tasks, view.pxPerHour, chart.clientWidth - namesW - 2);
  state.range = range;
  const body = bodySvg(r, vis, range, view.pxPerHour, P, { selectedIndex: selIndex, critical: view.critical, links: view.links });

  const names = vis
    .map((t) => {
      const tog = t.isSummary
        ? `<button class="n-tog" aria-label="${state.collapsed.has(t.id) ? "Expand" : "Collapse"}">${state.collapsed.has(t.id) ? "▸" : "▾"}</button>`
        : `<span class="n-tog"></span>`;
      const warn = t.errors.length ? `<span class="n-warn" title="${esc(t.errors.join("\n"))}">⚠</span>` : "";
      const cls = `n-row${t.isSummary ? " summary" : ""}${t.index === selIndex ? " sel" : ""}${view.critical && t.critical ? " crit" : ""}`;
      return `<div class="${cls}" data-i="${t.index}" style="--lvl:${t.level}"><span class="n-id">${esc(t.id)}</span>${tog}<span class="n-name" title="${esc(t.name)}">${esc(t.name) || "<i>(no name)</i>"}</span>${warn}<span class="n-dur">${fmtHours(t.duration)}</span></div>`;
    })
    .join("");

  const { scrollLeft, scrollTop } = chart;
  chart.innerHTML =
    `<div class="g-corner"><span class="c-name">Task</span><span>Hours</span><div class="splitter" title="Drag to resize"></div></div>` +
    `<div class="g-head"><svg width="${range.width}" height="${HEAD_H}">${headerSvg(range, view.pxPerHour, P)}</svg></div>` +
    `<div class="g-names">${names}</div>` +
    `<div class="g-body"><svg id="body-svg" width="${range.width}" height="${body.height}" font-family="Segoe UI, system-ui, sans-serif">${body.markup}</svg></div>`;
  chart.scrollLeft = scrollLeft;
  chart.scrollTop = scrollTop;

  renderStatus();
  renderDetails();
  $("btn-critical").setAttribute("aria-pressed", String(view.critical));
  $("btn-links").setAttribute("aria-pressed", String(view.links));
  $("btn-undo").disabled = !state.undo.length;
  $("btn-undo").title = state.undo.length ? `Undo: ${state.undo[state.undo.length - 1].label} (Ctrl+Z)` : "Nothing to undo";
}

function renderStatus() {
  const r = state.result;
  const issues = r.tasks.reduce((n, t) => n + t.errors.length, 0);
  const demo = state.source.kind === "demo" ? `<span class="warn">Demo</span> · ` : "";
  $("status").innerHTML =
    `${demo}<b>${fmtDT(r.projectStart)}</b> → <b>${fmtDT(r.projectFinish)}</b> · ${fmtHours(r.totalWork)} · ${r.tasks.length} rows` +
    (issues ? ` · <span class="warn">⚠ ${issues} issue${issues > 1 ? "s" : ""}</span>` : "") +
    ` · ${esc(state.where)}`;
  $("status").title = $("status").textContent;
}

function renderDetails() {
  const panel = $("details");
  const t = state.result?.tasks.find((x) => x.id === state.selectedId);
  if (!t) {
    panel.hidden = true;
    return;
  }
  const row = state.rows[t.index];
  panel.hidden = false;
  const active = document.activeElement;
  const focusKey = panel.contains(active) ? active.dataset.k : null;
  panel.innerHTML = `
    <div class="d-head">
      <span class="n-id">#${esc(t.id)}</span>
      <input data-k="name" value="${esc(row.name)}" aria-label="Task name" />
      <button class="close" data-act="close" aria-label="Close">✕</button>
    </div>
    <div class="d-grid">
      <label>Duration (hours)<input data-k="duration" type="number" min="0" step="0.25" value="${t.isSummary ? Math.round(t.duration * 100) / 100 : esc(t.duration)}" ${t.isSummary ? 'disabled title="Rolled up from the tasks inside"' : ""} /></label>
      <label>% complete<input data-k="pct" type="number" min="0" max="100" step="5" value="${Math.round(t.pct * 100)}" ${t.isSummary ? "disabled" : ""} /></label>
      <label>Predecessors<input data-k="preds" value="${esc(row.preds)}" placeholder="e.g. 3, 5SS+2h" /></label>
      <label>Fixed start<span class="inline"><input data-k="fixedStart" type="datetime-local" value="${toLocalInput(row.fixedStart)}" /><button data-act="clear-fixed" title="Clear fixed start" ${row.fixedStart === null ? "disabled" : ""}>✕</button></span></label>
      <label>Outline<span class="inline"><button data-act="outdent" title="Outdent" ${t.level === 0 ? "disabled" : ""}>◂ Out</button><button data-act="indent" title="Indent" ${t.index === 0 ? "disabled" : ""}>In ▸</button></span></label>
    </div>
    <div class="facts">
      <span>Start <b>${fmtDT(t.start)}</b></span>
      <span>Finish <b>${fmtDT(t.finish)}</b></span>
      <span>Float <b>${fmtHours(Math.max(0, t.float))}</b></span>
      ${t.critical ? '<span style="color:var(--danger)">Critical</span>' : ""}
      ${t.pushedBy?.length ? `<span>Held back by ${esc(t.pushedBy.join(", "))}</span>` : ""}
    </div>
    ${t.errors.length ? `<ul class="errors">${t.errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}`;
  if (focusKey) panel.querySelector(`[data-k="${focusKey}"]`)?.focus();
}

// ---------------------------------------------------------------------------------------
// data flow

let chain = Promise.resolve();
/** Runs Excel work one job at a time; failures become a toast. */
function run(fn) {
  const p = chain.then(fn).catch(showError);
  chain = p;
  return p;
}

async function reload() {
  const data = await state.source.load();
  if (!data) {
    state.result = null;
    render();
    return;
  }
  state.rows = data.rows;
  state.where = data.where;
  state.settings = normalizeSettings(data.settings ?? state.settings);
  if (!data.settings) await state.source.saveSettings(state.settings);
  state.result = schedule(state.rows, state.settings);
  render();
  await state.source.writeSchedule(state.result, state.rows);
}

/** Writes cell changes, remembering the old values for Undo. */
async function edit(changes, label) {
  const before = changes.map((c) => ({ row: state.rows[c.index].row, key: c.key, value: state.rows[c.index][c.key] ?? "" }));
  await state.source.setCells(changes, state.rows);
  state.undo.push({ label, changes: before });
  if (state.undo.length > 50) state.undo.shift();
  await reload();
}

async function undo() {
  const u = state.undo.pop();
  if (!u) return;
  const changes = u.changes
    .map((c) => ({ index: state.rows.findIndex((r) => r.row === c.row), key: c.key, value: c.value }))
    .filter((c) => c.index >= 0);
  await state.source.setCells(changes, state.rows);
  await reload();
  toast(`Undid: ${u.label}`);
}

function selectTask(index, syncExcel) {
  const t = state.result.tasks[index];
  state.selectedId = state.selectedId === t.id && !syncExcel ? null : t.id;
  render();
  if (syncExcel && state.source.kind === "excel") run(() => state.source.select(index, state.rows));
}

// ---------------------------------------------------------------------------------------
// chart interaction: select, drag to move, drag end to resize, drag dot to link

let drag = null;
const snapMs = () => (view.pxPerHour >= 40 ? 15 : view.pxPerHour >= 10 ? 30 : 60) * 60_000;
const snap = (ms) => Math.round(ms / snapMs()) * snapMs();

chart.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  if (e.target.closest(".splitter")) return startSplit(e);
  if (e.target.closest(".n-tog") && e.target.closest("button")) {
    const t = state.result.tasks[+e.target.closest(".n-row").dataset.i];
    state.collapsed.has(t.id) ? state.collapsed.delete(t.id) : state.collapsed.add(t.id);
    render();
    return;
  }
  const nameRow = e.target.closest(".n-row");
  if (nameRow) return selectTask(+nameRow.dataset.i, true);

  const bar = e.target.closest(".bar");
  if (!bar) return;
  const t = state.result.tasks[+bar.dataset.i];
  let role = e.target.dataset.role || "move";
  if (t.isSummary && role !== "link") role = "select";
  e.preventDefault();
  chart.setPointerCapture(e.pointerId);
  drag = { t, role, bar, x0: e.clientX, y0: e.clientY, moved: false, value: null, target: null };
  hideTip();
});

chart.addEventListener("pointermove", (e) => {
  if (!drag) return hover(e);
  const dx = e.clientX - drag.x0;
  if (!drag.moved && Math.abs(dx) < 4 && Math.abs(e.clientY - drag.y0) < 4) return;
  if (drag.role === "select") return;
  drag.moved = true;
  drag.bar.classList.add("dragging");
  const { t } = drag;
  const px = view.pxPerHour;
  const cal = state.result.calendar;
  const xOf = (ms) => ((ms - state.range.from) / HOUR) * px;

  if (drag.role === "move") {
    const ns = cal.nextWorking(snap(t.start + (dx / px) * HOUR));
    drag.value = ns;
    drag.bar.setAttribute("transform", `translate(${xOf(ns) - xOf(t.start)} 0)`);
    showTip(e, `<b>Start ${fmtDT(ns)}</b><span class="muted">Release to set Fixed Start</span>`);
  } else if (drag.role === "resize") {
    const stepH = snapMs() / HOUR;
    const want = cal.toWork(t.finish + (dx / px) * HOUR) - t.es;
    const hours = Math.max(stepH, Math.round(want / stepH) * stepH);
    const nf = cal.toDate(t.es + hours, true);
    drag.value = hours;
    const w = Math.max(2, xOf(nf) - xOf(t.start));
    const body = drag.bar.querySelector(".body");
    body.setAttribute("width", w);
    drag.bar.querySelector(".prog")?.setAttribute("width", w * t.pct);
    drag.bar.querySelector(".handle").setAttribute("x", xOf(t.start) + w - (w < 16 ? 1 : 4));
    drag.bar.querySelector("[data-role=link]").setAttribute("cx", xOf(t.start) + w + 11);
    showTip(e, `<b>${fmtHours(hours)}</b>finishes ${fmtDT(nf)}`);
  } else if (drag.role === "link") {
    const svg = $("body-svg");
    const box = svg.getBoundingClientRect();
    const dot = drag.bar.querySelector("[data-role=link]");
    let line = $("link-temp");
    if (!line) {
      svg.insertAdjacentHTML("beforeend", `<line id="link-temp" stroke="${palette().selEdge}" stroke-width="2" stroke-dasharray="4 3" pointer-events="none"/>`);
      line = $("link-temp");
    }
    line.setAttribute("x1", dot.getAttribute("cx"));
    line.setAttribute("y1", dot.getAttribute("cy"));
    line.setAttribute("x2", e.clientX - box.left);
    line.setAttribute("y2", e.clientY - box.top);
    const target = linkTargetAt(e.clientX, e.clientY);
    chart.querySelectorAll(".drop-target").forEach((el) => el.classList.remove("drop-target"));
    drag.target = target !== null && target !== t.index ? target : null;
    if (drag.target !== null) {
      chart.querySelector(`.bar[data-i="${drag.target}"]`)?.classList.add("drop-target");
      const to = state.result.tasks[drag.target];
      showTip(e, `<b>Link ${esc(t.id)} → ${esc(to.id)}</b>${esc(to.name)} starts after ${esc(t.name)}`);
    } else hideTip();
  }
});

function linkTargetAt(cx, cy) {
  const el = document.elementFromPoint(cx, cy);
  const hit = el?.closest(".bar, .n-row");
  return hit ? +hit.dataset.i : null;
}

const endDrag = (e) => {
  const d = drag;
  if (!d) return;
  drag = null;
  hideTip();
  if (e.type === "pointercancel") return render();
  if (!d.moved) return selectTask(d.t.index, true);
  const i = d.t.index;
  if (d.role === "move" && d.value !== null) {
    run(async () => {
      await edit([{ index: i, key: "fixedStart", value: d.value }], `move ${d.t.id}`);
      const now = state.result?.tasks[i];
      if (now?.pushedBy?.length) toast(`Can't start before ${now.pushedBy.join(", ")} finish — held at ${fmtDT(now.start)}`);
    });
  } else if (d.role === "resize" && d.value !== null) {
    run(() => edit([{ index: i, key: "duration", value: d.value }], `resize ${d.t.id}`));
  } else if (d.role === "link" && d.target !== null) {
    const j = d.target;
    const rows = state.rows;
    if (wouldCreateCycle(rows, i, j)) {
      toast("That link would create a loop.", true);
      render();
    } else {
      const next = addPredecessor(rows[j].preds, idOf(rows, i));
      if (next === String(rows[j].preds ?? "")) render();
      else run(() => edit([{ index: j, key: "preds", value: next }], `link ${idOf(rows, i)} → ${idOf(rows, j)}`));
    }
  } else render();
};
chart.addEventListener("pointerup", endDrag);
chart.addEventListener("pointercancel", endDrag);
chart.addEventListener("click", (e) => {
  if (e.target.dataset?.bg && state.selectedId !== null) {
    state.selectedId = null;
    render();
  }
});

function hover(e) {
  if (e.pointerType === "touch") return;
  const bar = e.target.closest?.(".bar");
  if (!bar) return hideTip();
  const t = state.result.tasks[+bar.dataset.i];
  showTip(
    e,
    `<b>${esc(t.id)} · ${esc(t.name)}</b>${fmtDT(t.start)} → ${fmtDT(t.finish)}<br>${fmtHours(t.duration)}${t.pct ? ` · ${Math.round(t.pct * 100)}% done` : ""}` +
      `<br><span class="muted">Float ${fmtHours(Math.max(0, t.float))}${t.critical ? " · critical" : ""}</span>`,
  );
}
chart.addEventListener("pointerleave", () => !drag && hideTip());

function showTip(e, html) {
  const tip = $("tip");
  tip.innerHTML = html;
  tip.hidden = false;
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  tip.style.left = `${clamp(e.clientX + 14, 4, innerWidth - w - 4)}px`;
  tip.style.top = `${e.clientY + 18 + h > innerHeight ? e.clientY - h - 10 : e.clientY + 18}px`;
}
const hideTip = () => ($("tip").hidden = true);

function startSplit(e) {
  e.preventDefault();
  const x0 = e.clientX;
  const w0 = namesWidth();
  const el = e.target;
  el.setPointerCapture(e.pointerId);
  const move = (ev) => {
    view.namesW = clamp(w0 + ev.clientX - x0, 110, Math.max(160, innerWidth - 80));
    chart.style.setProperty("--names-w", `${view.namesW}px`);
  };
  const up = () => {
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    saveView();
    render();
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
}

// ---------------------------------------------------------------------------------------
// zoom

function setZoom(px, anchorClientX) {
  if (!state.result) return;
  const box = chart.getBoundingClientRect();
  const nw = namesWidth();
  const offset = (anchorClientX ?? box.left + nw + (box.width - nw) / 2) - box.left - nw;
  const time = state.range.from + ((chart.scrollLeft + offset) / view.pxPerHour) * HOUR;
  view.pxPerHour = clamp(px, MIN_PX, MAX_PX);
  saveView();
  render();
  chart.scrollLeft = ((time - state.range.from) / HOUR) * view.pxPerHour - offset;
}

function fit() {
  const r = state.result;
  if (!r) return;
  const hours = (r.projectFinish - r.projectStart) / HOUR + 5;
  view.pxPerHour = clamp((chart.clientWidth - namesWidth() - 30) / hours, MIN_PX, MAX_PX);
  saveView();
  render();
  chart.scrollLeft = 0;
}

chart.addEventListener(
  "wheel",
  (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setZoom(view.pxPerHour * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX);
  },
  { passive: false },
);

// ---------------------------------------------------------------------------------------
// details panel edits

$("details").addEventListener("change", (e) => {
  const k = e.target.dataset.k;
  const t = state.result?.tasks.find((x) => x.id === state.selectedId);
  if (!k || !t) return;
  let value = e.target.value;
  if (k === "duration") {
    value = parseFloat(value);
    if (!(value >= 0)) return toast("Duration must be 0 or more hours.", true);
  } else if (k === "pct") {
    value = clamp(parseFloat(value) || 0, 0, 100) / 100;
  } else if (k === "fixedStart") {
    value = fromLocalInput(value);
  }
  run(() => edit([{ index: t.index, key: k, value }], `edit ${t.id}`));
});

$("details").addEventListener("click", (e) => {
  const act = e.target.closest("[data-act]")?.dataset.act;
  const t = state.result?.tasks.find((x) => x.id === state.selectedId);
  if (!act || !t) return;
  e.preventDefault();
  if (act === "close") {
    state.selectedId = null;
    render();
  } else if (act === "clear-fixed") {
    run(() => edit([{ index: t.index, key: "fixedStart", value: null }], `clear fixed start ${t.id}`));
  } else if (act === "indent" || act === "outdent") {
    const cur = Math.max(0, Math.floor(Number(state.rows[t.index].level) || 0));
    const prev = t.index > 0 ? state.result.tasks[t.index - 1].level : 0;
    const level = act === "indent" ? Math.min(cur + 1, prev + 1) : Math.max(0, Math.min(cur, t.level) - 1);
    if (level !== cur) run(() => edit([{ index: t.index, key: "level", value: level }], `${act} ${t.id}`));
  }
});

// ---------------------------------------------------------------------------------------
// toolbar & menu

const on = (id, fn) => $(id).addEventListener("click", fn);
on("btn-refresh", () => run(reload));
on("btn-zoom-in", () => setZoom(view.pxPerHour * 1.5));
on("btn-zoom-out", () => setZoom(view.pxPerHour / 1.5));
on("btn-fit", fit);
on("btn-critical", () => {
  view.critical = !view.critical;
  saveView();
  render();
});
on("btn-links", () => {
  view.links = !view.links;
  saveView();
  render();
});
on("btn-undo", () => run(undo));

const menu = $("menu");
const closeMenu = () => {
  menu.hidden = true;
  $("btn-more").setAttribute("aria-expanded", "false");
};
on("btn-more", (e) => {
  e.stopPropagation();
  menu.hidden = !menu.hidden;
  $("btn-more").setAttribute("aria-expanded", String(!menu.hidden));
  $("mi-snapshot").textContent = state.source?.canInsertImage() ? "Insert chart picture into sheet" : "Download chart picture";
  if (!menu.hidden) menu.querySelector("button")?.focus();
});
document.addEventListener("click", (e) => !menu.contains(e.target) && closeMenu());
menu.addEventListener("click", closeMenu);

on("mi-sequential", () => {
  if (!state.result) return;
  const wanted = sequentialPredecessors(state.rows);
  const changes = wanted
    .map((value, index) => ({ index, key: "preds", value }))
    .filter((c) => String(state.rows[c.index].preds ?? "") !== c.value);
  if (!changes.length) return toast("Tasks are already linked in order.");
  run(async () => {
    await edit(changes, "link in order");
    toast(`Linked ${changes.length} task${changes.length > 1 ? "s" : ""} in order. Undo reverts it.`);
  });
});

async function createSheet(withSample) {
  const rows = withSample
    ? sampleRows()
    : [{ id: "1", name: "First task", level: 0, duration: 8, preds: "", fixedStart: null, pct: 0 }];
  await state.source.createSheet(rows);
  state.selectedId = null;
  state.collapsed.clear();
  state.undo = [];
  const s = normalizeSettings(state.settings);
  s.projectStart = nextMondayMorning();
  state.settings = s;
  await state.source.saveSettings(s);
  await reload();
  fit();
  toast(withSample ? "Sample plan created." : "Task sheet created — add rows to the table.");
}
on("mi-sample", () => run(() => createSheet(true)));
on("mi-blank", () => run(() => createSheet(false)));
on("btn-empty-sample", () => run(() => createSheet(true)));
on("btn-empty-blank", () => run(() => createSheet(false)));
on("mi-help", () => $("help").showModal());
on("mi-snapshot", () => run(snapshot));

// settings dialog
on("mi-settings", () => {
  const f = $("settings-form");
  const s = normalizeSettings(state.settings);
  f.projectStart.value = toLocalInput(s.projectStart);
  f.hoursPerDay.value = s.hoursPerDay;
  const sh = Math.round(s.shiftStart * 60);
  f.shiftStart.value = `${pad2(Math.floor(sh / 60))}:${pad2(sh % 60)}`;
  s.workDays.forEach((v, i) => (f[`wd${i}`].checked = v));
  $("settings").showModal();
});
$("settings").addEventListener("close", () => {
  if ($("settings").returnValue !== "save") return;
  const f = $("settings-form");
  const [hh, mm] = f.shiftStart.value.split(":").map(Number);
  const s = {
    ...normalizeSettings(state.settings),
    projectStart: fromLocalInput(f.projectStart.value) ?? state.settings.projectStart,
    hoursPerDay: clamp(parseFloat(f.hoursPerDay.value) || 24, 0.5, 24),
    shiftStart: (hh || 0) + (mm || 0) / 60,
    workDays: Array.from({ length: 7 }, (_, i) => f[`wd${i}`].checked),
  };
  if (!s.workDays.some(Boolean)) s.workDays = Array(7).fill(true);
  run(async () => {
    state.settings = s;
    await state.source.saveSettings(s);
    await reload();
  });
});

document.addEventListener("keydown", (e) => {
  const typing = e.target.matches?.("input, textarea");
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) {
    e.preventDefault();
    run(undo);
  } else if (e.key === "Escape" && !typing) {
    closeMenu();
    if (state.selectedId !== null) {
      state.selectedId = null;
      render();
    }
  }
});

// ---------------------------------------------------------------------------------------
// picture of the chart (inserted into the sheet, or downloaded)

function exportSvg() {
  const r = state.result;
  const P = LIGHT;
  const vis = state.visible;
  const probe = computeRange(r.tasks, 1);
  const px = clamp(1500 / ((probe.to - probe.from) / HOUR), MIN_PX, Math.max(view.pxPerHour, 2));
  const range = computeRange(r.tasks, px);
  const NW = 340;
  const TITLE = 30;
  const body = bodySvg(r, vis, range, px, P, { critical: view.critical, links: view.links, markerPrefix: "x", interactive: false });
  const W = NW + range.width;
  const H = TITLE + HEAD_H + body.height;
  const names = vis
    .map((t, i) => {
      const y = TITLE + HEAD_H + i * ROW_H + ROW_H / 2 + 4;
      const name = t.name.length > 44 - t.level * 3 ? `${t.name.slice(0, 42 - t.level * 3)}…` : t.name;
      const color = view.critical && t.critical ? P.critEdge : P.text;
      return (
        `<text x="10" y="${y}" font-size="11" fill="${P.muted}">${esc(t.id)}</text>` +
        `<text x="${38 + t.level * 14}" y="${y}" font-size="12" fill="${color}" ${t.isSummary ? 'font-weight="600"' : ""}>${esc(name)}</text>` +
        `<text x="${NW - 10}" y="${y}" font-size="11" fill="${P.muted}" text-anchor="end">${fmtHours(t.duration)}</text>` +
        `<line x1="0" x2="${NW}" y1="${y + ROW_H / 2 - 4.5}" y2="${y + ROW_H / 2 - 4.5}" stroke="${P.grid}"/>`
      );
    })
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, sans-serif">` +
    `<rect width="${W}" height="${H}" fill="#ffffff"/>` +
    `<text x="10" y="20" font-size="13" font-weight="600" fill="${P.text}">${fmtDT(r.projectStart)} → ${fmtDT(r.projectFinish)} · ${fmtHours(r.totalWork)}</text>` +
    `<text x="10" y="${TITLE + HEAD_H - 6}" font-size="11" fill="${P.muted}">Task</text>` +
    `<text x="${NW - 10}" y="${TITLE + HEAD_H - 6}" font-size="11" fill="${P.muted}" text-anchor="end">Hours</text>` +
    names +
    `<line x1="${NW - 0.5}" x2="${NW - 0.5}" y1="${TITLE}" y2="${H}" stroke="${P.gridStrong}"/>` +
    `<g transform="translate(${NW} ${TITLE})">${headerSvg(range, px, P)}</g>` +
    `<line x1="0" x2="${W}" y1="${TITLE + HEAD_H - 0.5}" y2="${TITLE + HEAD_H - 0.5}" stroke="${P.gridStrong}"/>` +
    `<g transform="translate(${NW} ${TITLE + HEAD_H})">${body.markup}</g>` +
    `</svg>`;
  return { svg, width: W, height: H };
}

async function snapshot() {
  if (!state.result) return;
  const { svg, width, height } = exportSvg();
  const scale = Math.min(2, 12000 / width, 12000 / height);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);
  const dataUrl = canvas.toDataURL("image/png");
  if (state.source.canInsertImage()) {
    await state.source.insertImage(dataUrl.split(",")[1], width);
    toast("Chart picture placed next to the table.");
  } else {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "gantt-chart.png";
    a.click();
  }
}

// ---------------------------------------------------------------------------------------
// toast

let toastTimer;
function toast(msg, isError = false) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.toggle("error", isError);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), isError ? 6000 : 3500);
}
function showError(err) {
  console.error(err);
  const msg = err?.debugInfo?.message || err?.message || String(err);
  toast(msg, true);
}

// ---------------------------------------------------------------------------------------
// start: inside Excel use the workbook, anywhere else run the demo

let resizeTimer;
addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => state.result && render(), 150);
});
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => state.result && render());

function start(inExcel) {
  if (state.source) return;
  state.source = inExcel ? new ExcelSource() : new MemorySource();
  let pending;
  state.source.onChange(() => {
    clearTimeout(pending);
    pending = setTimeout(() => run(reload), 350);
  });
  run(async () => {
    await reload();
    if (!storage.get(VIEW_KEY)) fit();
  });
}

if (window.Office?.onReady) {
  Office.onReady((info) => start(info.host === Office.HostType.Excel));
} else {
  start(false); // office.js blocked or offline
}
