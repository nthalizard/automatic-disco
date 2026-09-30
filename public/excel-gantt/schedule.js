// Scheduling engine for the Excel Gantt add-in. Pure functions, no DOM or Office.js, so it
// can be unit-tested (src/gantt/schedule.test.ts).
//
// Time model: Excel date serials carry no time zone, so every instant here is a "naive"
// wall-clock time stored as milliseconds and read back with getUTC* — this sidesteps
// daylight-saving jumps entirely. Durations, lags and floats are in WORKING hours; the
// calendar maps working-hour offsets (from the project start) to wall-clock instants.

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
const EXCEL_EPOCH_OFFSET = 25569; // serial of 1970-01-01

export const serialToMs = (serial) => Math.round((serial - EXCEL_EPOCH_OFFSET) * DAY);
export const msToSerial = (ms) => ms / DAY + EXCEL_EPOCH_OFFSET;

/** Current local wall-clock time as a naive instant. */
export function nowNaive(d = new Date()) {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes());
}

/** Excel cell value (serial number, Date-like string, or blank) → naive ms, or null. */
export function parseDateValue(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && isFinite(v)) return v > 0 ? serialToMs(v) : null;
  const s = String(v).trim();
  if (!s) return null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?/.exec(s);
  if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3], +(iso[4] ?? 0), +(iso[5] ?? 0));
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return nowNaive(d);
}

/** Duration cell → working hours. Numbers are hours; strings may carry a unit ("2d", "30 min", "3 hrs"). */
export function parseDuration(v, hoursPerDay = 24) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isFinite(v) && v >= 0 ? v : null;
  const m = /^\s*(\d*\.?\d+)\s*([a-z]*)\s*$/i.exec(String(v));
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (!unit || /^h(ou)?r?s?$/.test(unit)) return n;
  if (/^d(ays?)?$/.test(unit)) return n * hoursPerDay;
  if (/^w(ks?|eeks?)?$/.test(unit)) return n * hoursPerDay * 5;
  if (/^m(in(ute)?s?)?$/.test(unit)) return n / 60;
  return null;
}

/** "% complete" cell → 0..1. Accepts 0.5, 50, "50%". */
export function parsePercent(v) {
  if (v === null || v === undefined || v === "") return 0;
  let n = typeof v === "number" ? v : parseFloat(String(v));
  if (!isFinite(n)) return 0;
  if (typeof v === "string" && v.includes("%")) n /= 100;
  else if (n > 1) n /= 100;
  return Math.min(1, Math.max(0, n));
}

// ---------------------------------------------------------------------------------------
// Calendar

/**
 * Working calendar. Each working day has one shift that starts at `shiftStart` (hour of day)
 * and lasts `hoursPerDay`; a shift may run past midnight. 24 h/day on every day = round the clock.
 */
export class WorkCalendar {
  constructor({ hoursPerDay = 24, shiftStart = 0, workDays } = {}, originMs = 0) {
    this.hoursPerDay = Math.min(24, Math.max(0.5, Number(hoursPerDay) || 24));
    this.shiftStart = Math.min(23.99, Math.max(0, Number(shiftStart) || 0));
    const wd = Array.isArray(workDays) && workDays.length === 7 ? workDays.map(Boolean) : Array(7).fill(true);
    this.workDays = wd.some(Boolean) ? wd : Array(7).fill(true);
    this.continuous = this.hoursPerDay >= 24 && this.workDays.every(Boolean);
    this.origin = this.nextWorking(originMs);
  }

  /** Working intervals [start, end) that end after `ms`, in order. */
  *intervals(ms) {
    let d = Math.floor(ms / DAY) * DAY - DAY; // a shift that began yesterday may still be running
    for (let guard = 0; guard < 200_000; guard++, d += DAY) {
      if (!this.workDays[new Date(d).getUTCDay()]) continue;
      const s = d + Math.round(this.shiftStart * HOUR);
      const e = s + Math.round(this.hoursPerDay * HOUR);
      if (e > ms) yield [s, e];
    }
  }

  /** First working instant at or after `ms`. */
  nextWorking(ms) {
    if (this.continuous) return ms;
    for (const [s] of this.intervals(ms)) return Math.max(s, ms);
    return ms;
  }

  /**
   * Working-hour offset from the origin → wall-clock instant. A start lands at the beginning
   * of the next shift when it falls exactly on a shift end; a finish (`atEnd`) stays at the end.
   */
  toDate(hours, atEnd = false) {
    if (this.continuous) return this.origin + Math.round(hours * HOUR);
    if (hours <= 0) return this.origin + Math.round(hours * HOUR); // before the project start: no calendar
    let remaining = Math.round(hours * HOUR);
    for (const [s0, e] of this.intervals(this.origin)) {
      const s = Math.max(s0, this.origin);
      const len = e - s;
      if (atEnd ? remaining <= len : remaining < len) return s + remaining;
      remaining -= len;
    }
    return this.origin;
  }

  /** Wall-clock instant → working hours elapsed since the origin (negative before it). */
  toWork(ms) {
    if (this.continuous || ms <= this.origin) return (ms - this.origin) / HOUR;
    let total = 0;
    for (const [s0, e] of this.intervals(this.origin)) {
      const s = Math.max(s0, this.origin);
      if (s >= ms) break;
      total += Math.min(e, ms) - s;
      if (e >= ms) break;
    }
    return total / HOUR;
  }

  /** Non-working stretches overlapping [from, to), for shading the chart. */
  gaps(from, to) {
    if (this.continuous) return [];
    const out = [];
    let cursor = from;
    for (const [s, e] of this.intervals(from)) {
      if (s >= to) break;
      if (s > cursor) out.push([cursor, s]);
      cursor = Math.max(cursor, e);
      if (cursor >= to) break;
    }
    if (cursor < to) out.push([cursor, to]);
    return out;
  }
}

// ---------------------------------------------------------------------------------------
// Predecessors

const LINK_RE = /^([^\s+-]+?)\s*(FS|SS|FF)?\s*(?:([+-])\s*(\d*\.?\d+)\s*([a-z]*))?$/i;

/** "3, 5SS+2h, 7FF-1d" → links. Lag units: h (default), d (working days), m (minutes). */
export function parsePredecessors(text, hoursPerDay = 24) {
  const links = [];
  const errors = [];
  for (const raw of String(text ?? "").split(/[,;]/)) {
    const tok = raw.trim();
    if (!tok) continue;
    const m = LINK_RE.exec(tok);
    if (!m) {
      errors.push(`Can't read predecessor "${tok}"`);
      continue;
    }
    let lag = 0;
    if (m[4] !== undefined) {
      const lagHours = parseDuration(`${m[4]}${m[5] || "h"}`, hoursPerDay);
      if (lagHours === null) {
        errors.push(`Can't read lag in "${tok}"`);
        continue;
      }
      lag = m[3] === "-" ? -lagHours : lagHours;
    }
    links.push({ id: normalizeId(m[1]), type: (m[2] || "FS").toUpperCase(), lag });
  }
  return { links, errors };
}

/** Links → text, the inverse of parsePredecessors (lags written in hours). */
export function formatPredecessors(links) {
  return links
    .map((l) => {
      const type = l.type && l.type !== "FS" ? l.type : "";
      const lag = l.lag ? `${l.lag > 0 ? "+" : "-"}${round(Math.abs(l.lag), 2)}h` : "";
      return `${l.id}${type || (lag ? "FS" : "")}${lag}`;
    })
    .join(", ");
}

export const normalizeId = (v) => {
  const s = String(v ?? "").trim();
  return /^\d+\.0+$/.test(s) ? s.replace(/\.0+$/, "") : s;
};
const round = (n, dp) => Math.round(n * 10 ** dp) / 10 ** dp;

// ---------------------------------------------------------------------------------------
// Scheduling

/**
 * @param {Array<{id?:any,name?:string,level?:any,duration?:any,preds?:any,fixedStart?:number|null,pct?:any}>} rows
 *   one entry per table row, in order. fixedStart is a naive ms ("start no earlier than").
 * @param {{projectStart:number, hoursPerDay?:number, shiftStart?:number, workDays?:boolean[]}} settings
 */
export function schedule(rows, settings) {
  const cal = new WorkCalendar(settings, settings.projectStart);
  const n = rows.length;

  const tasks = rows.map((r, i) => {
    const errors = [];
    const dur = parseDuration(r.duration, cal.hoursPerDay);
    if (r.duration !== null && r.duration !== undefined && r.duration !== "" && dur === null) {
      errors.push(`Can't read duration "${r.duration}"`);
    }
    const lvl = Math.max(0, Math.floor(Number(r.level) || 0));
    const { links, errors: linkErrors } = parsePredecessors(r.preds, cal.hoursPerDay);
    return {
      index: i,
      id: normalizeId(r.id) || String(i + 1),
      name: String(r.name ?? "").trim(),
      rawLevel: lvl,
      level: 0,
      duration: dur ?? 0,
      links,
      fixedStart: typeof r.fixedStart === "number" && isFinite(r.fixedStart) ? r.fixedStart : null,
      pct: parsePercent(r.pct),
      parent: -1,
      children: [],
      isSummary: false,
      errors: [...errors, ...linkErrors],
      es: 0,
      ef: 0,
      ls: 0,
      lf: 0,
      float: 0,
      critical: false,
      start: 0,
      finish: 0,
    };
  });

  // Outline: a row's parent is the nearest row above it with a lower level. Levels that jump
  // by more than one are pulled in so the outline stays well formed.
  const stack = [];
  for (const t of tasks) {
    while (stack.length && tasks[stack[stack.length - 1]].rawLevel >= t.rawLevel) stack.pop();
    t.level = stack.length;
    if (stack.length) {
      const p = tasks[stack[stack.length - 1]];
      t.parent = p.index;
      p.children.push(t.index);
      p.isSummary = true;
    }
    stack.push(t.index);
  }

  const leavesOf = (t) => (t.isSummary ? t.children.flatMap((c) => leavesOf(tasks[c])) : [t.index]);
  const ancestors = (t) => {
    const out = [];
    for (let p = t.parent; p >= 0; p = tasks[p].parent) out.push(tasks[p]);
    return out;
  };

  const byId = new Map();
  for (const t of tasks) {
    if (byId.has(t.id)) t.errors.push(`Duplicate ID "${t.id}"`);
    else byId.set(t.id, t.index);
  }

  // Expand every link to leaf→leaf edges. A link to/from a summary applies to its leaves; a
  // start-to-start link from a summary uses its first leaf (the summary starts with it).
  const preds = Array.from({ length: n }, () => []);
  const succs = Array.from({ length: n }, () => []);
  for (const t of tasks) {
    const targets = leavesOf(t);
    for (const link of t.links) {
      const pi = byId.get(link.id);
      if (pi === undefined) {
        t.errors.push(`No task with ID "${link.id}"`);
        continue;
      }
      if (pi === t.index) {
        t.errors.push("A task can't depend on itself");
        continue;
      }
      const p = tasks[pi];
      if (ancestors(t).includes(p) || ancestors(p).includes(t)) {
        t.errors.push(`Can't link a task to its own summary ("${link.id}")`);
        continue;
      }
      const sources = leavesOf(p);
      const from = link.type === "SS" ? sources.slice(0, 1) : sources;
      for (const a of from) {
        for (const b of targets) {
          preds[b].push({ from: a, type: link.type, lag: link.lag });
          succs[a].push({ to: b, type: link.type, lag: link.lag });
        }
      }
    }
  }

  // Topological order over leaves (Kahn). Anything left over sits on a loop.
  const leaves = tasks.filter((t) => !t.isSummary).map((t) => t.index);
  const indeg = new Array(n).fill(0);
  for (const b of leaves) indeg[b] = preds[b].length;
  const queue = leaves.filter((i) => indeg[i] === 0);
  const order = [];
  while (queue.length) {
    const i = queue.shift();
    order.push(i);
    for (const e of succs[i]) if (--indeg[e.to] === 0) queue.push(e.to);
  }
  const done = new Set(order);
  for (const i of leaves) {
    if (!done.has(i)) {
      tasks[i].errors.push("Circular dependency");
      order.push(i);
    }
  }
  const placed = new Set();

  // Forward pass.
  const snet = (t) => {
    let w = 0;
    for (const x of [t, ...ancestors(t)]) if (x.fixedStart !== null) w = Math.max(w, cal.toWork(x.fixedStart));
    return w;
  };
  for (const i of order) {
    const t = tasks[i];
    let es = snet(t);
    for (const e of preds[i]) {
      if (!placed.has(e.from)) continue; // only on a loop
      const p = tasks[e.from];
      const bound = e.type === "SS" ? p.es + e.lag : e.type === "FF" ? p.ef + e.lag - t.duration : p.ef + e.lag;
      es = Math.max(es, bound);
    }
    t.es = es;
    t.ef = es + t.duration;
    placed.add(i);
  }

  // Backward pass → float and critical path.
  const projectEnd = leaves.length ? Math.max(...leaves.map((i) => tasks[i].ef)) : 0;
  for (const i of leaves) tasks[i].lf = projectEnd;
  for (let k = order.length - 1; k >= 0; k--) {
    const t = tasks[order[k]];
    for (const e of succs[t.index]) {
      const s = tasks[e.to];
      const bound = e.type === "SS" ? s.ls - e.lag + t.duration : e.type === "FF" ? s.lf - e.lag : s.ls - e.lag;
      t.lf = Math.min(t.lf, bound);
    }
    t.ls = t.lf - t.duration;
    t.float = t.ls - t.es;
    t.critical = t.float < 1e-6;
  }

  // Summaries roll up their leaves. Children come after parents, so walk bottom-up.
  for (let i = n - 1; i >= 0; i--) {
    const t = tasks[i];
    if (!t.isSummary) continue;
    const ls = leavesOf(t).map((j) => tasks[j]);
    t.es = Math.min(...ls.map((x) => x.es));
    t.ef = Math.max(...ls.map((x) => x.ef));
    t.duration = t.ef - t.es;
    t.float = Math.min(...ls.map((x) => x.float));
    t.critical = ls.some((x) => x.critical);
    const work = ls.reduce((a, x) => a + x.duration, 0);
    t.pct = work > 0 ? ls.reduce((a, x) => a + x.duration * x.pct, 0) / work : ls.every((x) => x.pct >= 1) ? 1 : 0;
  }

  for (const t of tasks) {
    t.start = cal.toDate(t.es);
    t.finish = t.duration > 0 ? cal.toDate(t.ef, true) : t.start;
    // A fixed start that the logic overrides is worth pointing out.
    if (t.fixedStart !== null && t.start > cal.nextWorking(t.fixedStart) + 60_000) {
      t.pushedBy = preds[t.index].map((e) => tasks[e.from].id);
    }
  }

  const links = [];
  for (const t of tasks) {
    for (const l of t.links) {
      const pi = byId.get(l.id);
      if (pi !== undefined && pi !== t.index) links.push({ from: pi, to: t.index, type: l.type, lag: l.lag });
    }
  }

  return {
    tasks,
    links,
    calendar: cal,
    projectStart: cal.origin,
    projectFinish: tasks.length ? Math.max(...tasks.map((t) => t.finish)) : cal.origin,
    totalWork: projectEnd,
  };
}

/** Predecessor text that chains every non-summary row to the one before it (Finish-to-Start). */
export function sequentialPredecessors(rows) {
  const levels = rows.map((r) => Math.max(0, Math.floor(Number(r.level) || 0)));
  const ids = rows.map((r, i) => normalizeId(r.id) || String(i + 1));
  let prev = null;
  return rows.map((_, i) => {
    const isSummary = i + 1 < rows.length && levels[i + 1] > levels[i];
    if (isSummary) return "";
    const text = prev === null ? "" : prev;
    prev = ids[i];
    return text;
  });
}

/** Would adding `fromId` as a predecessor of row `toIndex` create a loop? */
export function wouldCreateCycle(rows, fromIndex, toIndex) {
  const r = schedule(
    rows.map((row, i) => (i === toIndex ? { ...row, preds: addPredecessor(row.preds, idOf(rows, fromIndex)) } : row)),
    { projectStart: 0 },
  );
  return r.tasks.some((t) => t.errors.some((e) => e === "Circular dependency" || e.startsWith("Can't link")));
}

export const idOf = (rows, i) => normalizeId(rows[i].id) || String(i + 1);

/** Adds `id` to a predecessor string unless it is already there. */
export function addPredecessor(text, id) {
  const { links } = parsePredecessors(text);
  if (links.some((l) => l.id === id)) return String(text ?? "");
  const t = String(text ?? "").trim();
  return t ? `${t}, ${id}` : id;
}
