// Where the task list lives. ExcelSource reads/writes a table in the open workbook;
// MemorySource backs the in-browser demo (page opened outside Excel). Both expose:
//   load() → { rows, settings, where } | null      rows: [{ row, id, name, level, duration, preds, fixedStart, pct }]
//   setCells([{ index, key, value }])               index = position in `rows`
//   writeSchedule(result, rows)                     push computed Start/Finish back (Excel only)
//   select(index), saveSettings(s), onChange(cb), createSheet(rows, settings)

import { msToSerial, parseDateValue } from "./schedule.js";
import { sampleRows } from "./sample.js";

export const TABLE_NAME = "GanttTasks";
const SETTINGS_KEY = "ganttSettings";
const DATE_FORMAT = "ddd m/d/yy h:mm";

// Header text accepted for each field (compared lower-case, trimmed). The first is the
// header used when the add-in creates a column.
export const COLUMNS = {
  id: ["ID", "#", "task id", "no", "no.", "wbs"],
  name: ["Task", "task name", "name", "activity", "description"],
  level: ["Level", "outline level", "indent"],
  duration: ["Duration (hrs)", "duration", "duration (h)", "duration (hours)", "hrs", "hours"],
  preds: ["Predecessors", "predecessor", "depends on", "dependencies"],
  fixedStart: ["Fixed Start", "start no earlier than", "snet", "constraint", "planned start"],
  pct: ["% Complete", "% done", "%", "progress", "percent complete"],
  start: ["Start", "start date", "scheduled start"],
  finish: ["Finish", "end", "finish date", "end date", "scheduled finish"],
};
const INPUT_KEYS = ["id", "name", "level", "duration", "preds", "fixedStart", "pct"];

export function mapHeaders(headers) {
  const map = {};
  headers.forEach((h, c) => {
    const text = String(h ?? "").trim().toLowerCase();
    for (const [key, names] of Object.entries(COLUMNS)) {
      if (map[key] === undefined && names.some((n) => n.toLowerCase() === text)) map[key] = c;
    }
  });
  return map;
}

const isBlankRow = (vals, cols) =>
  INPUT_KEYS.every((k) => cols[k] === undefined || vals[cols[k]] === "" || vals[cols[k]] === null);

function rowFromValues(vals, cols, row) {
  const get = (k) => (cols[k] === undefined ? "" : vals[cols[k]]);
  return {
    row,
    id: get("id"),
    name: get("name"),
    level: get("level"),
    duration: get("duration"),
    preds: get("preds") === null ? "" : String(get("preds")),
    fixedStart: parseDateValue(get("fixedStart")),
    pct: get("pct"),
  };
}

// ---------------------------------------------------------------------------------------

export class ExcelSource {
  kind = "excel";
  tableName = null;
  cols = {};
  values = []; // body values from the last load
  listeners = [];
  watching = null;
  structureKey = "";

  async findTable(ctx) {
    const named = ctx.workbook.tables.getItemOrNullObject(TABLE_NAME);
    await ctx.sync();
    if (!named.isNullObject) return named;
    const tables = ctx.workbook.tables.load("items/name");
    await ctx.sync();
    const heads = tables.items.map((t) => t.getHeaderRowRange().load("values"));
    await ctx.sync();
    const i = heads.findIndex((h) => {
      const m = mapHeaders(h.values[0]);
      return m.name !== undefined && m.duration !== undefined;
    });
    return i >= 0 ? tables.items[i] : null;
  }

  async load() {
    return Excel.run(async (ctx) => {
      const table = await this.findTable(ctx);
      if (!table) return null;
      const header = table.getHeaderRowRange().load("values");
      const body = table.getDataBodyRange().load("values");
      table.load("name");
      table.worksheet.load("name");
      await ctx.sync();
      this.tableName = table.name;
      this.cols = mapHeaders(header.values[0]);
      this.values = body.values;
      if (this.watching !== table.name) {
        table.onChanged.add(async () => this.listeners.forEach((cb) => cb()));
        await ctx.sync();
        this.watching = table.name;
      }
      const rows = [];
      body.values.forEach((vals, r) => {
        if (!isBlankRow(vals, this.cols)) rows.push(rowFromValues(vals, this.cols, r));
      });
      return { rows, settings: readDocSettings(), where: `${table.worksheet.name} › ${table.name}` };
    });
  }

  onChange(cb) {
    this.listeners.push(cb);
  }

  /** Adds any missing columns for `keys`; returns the table. */
  async ensureColumns(ctx, keys) {
    const table = ctx.workbook.tables.getItem(this.tableName);
    const missing = keys.filter((k) => this.cols[k] === undefined);
    if (!missing.length) return table;
    for (const k of missing) table.columns.add(null, null, COLUMNS[k][0]);
    const header = table.getHeaderRowRange().load("values");
    await ctx.sync();
    this.cols = mapHeaders(header.values[0]);
    return table;
  }

  async setCells(changes, rows) {
    if (!changes.length) return;
    await Excel.run(async (ctx) => {
      const table = await this.ensureColumns(ctx, [...new Set(changes.map((c) => c.key))]);
      const body = table.getDataBodyRange();
      for (const { index, key, value } of changes) {
        const cell = body.getCell(rows[index].row, this.cols[key]);
        if (key === "fixedStart") {
          cell.numberFormat = [[DATE_FORMAT]];
          cell.values = [[value === null ? "" : msToSerial(value)]];
        } else if (key === "preds" || key === "id") {
          cell.numberFormat = [["@"]]; // keep "3, 5" from being read as the number 35
          cell.values = [[value]];
        } else if (key === "pct") {
          cell.numberFormat = [["0%"]];
          cell.values = [[value]];
        } else {
          cell.values = [[value]];
        }
      }
      await ctx.sync();
    });
  }

  /** Writes computed Start/Finish (and summary durations) where they differ from the sheet. */
  async writeSchedule(result, rows) {
    await Excel.run(async (ctx) => {
      const table = await this.ensureColumns(ctx, ["start", "finish"]);
      const body = table.getDataBodyRange();
      const cur = this.values;
      const same = (a, b) => typeof a === "number" && Math.abs(a - b) < 1 / 2880; // 30 s
      for (const key of ["start", "finish"]) {
        const c = this.cols[key];
        let dirty = false;
        const col = cur.map((vals) => [vals[c] ?? ""]);
        rows.forEach((r, i) => {
          const v = msToSerial(result.tasks[i][key]);
          if (!same(col[r.row][0], v)) dirty = true;
          col[r.row][0] = v;
        });
        if (dirty && col.length) {
          const range = body.getColumn(c);
          range.numberFormat = col.map(() => [DATE_FORMAT]);
          range.values = col;
        }
      }
      const dc = this.cols.duration;
      rows.forEach((r, i) => {
        if (dc === undefined) return;
        const t = result.tasks[i];
        const v = Math.round(t.duration * 100) / 100;
        if (t.isSummary && cur[r.row]?.[dc] !== v) body.getCell(r.row, dc).values = [[v]];
      });

      // Outline look: indent names, bold summaries. Only when the outline changes.
      const key = result.tasks.map((t) => `${t.level}${t.isSummary ? "s" : ""}`).join(",");
      if (key !== this.structureKey && this.cols.name !== undefined) {
        const canIndent = Office.context.requirements.isSetSupported("ExcelApi", "1.9");
        rows.forEach((r, i) => {
          const t = result.tasks[i];
          body.getRow(r.row).format.font.bold = t.isSummary;
          if (canIndent) body.getCell(r.row, this.cols.name).format.indentLevel = Math.min(t.level * 2, 15);
        });
        this.structureKey = key;
      }
      await ctx.sync();
    });
  }

  async select(index, rows) {
    await Excel.run(async (ctx) => {
      const table = ctx.workbook.tables.getItem(this.tableName);
      table.worksheet.activate();
      table
        .getDataBodyRange()
        .getCell(rows[index].row, this.cols.name ?? 0)
        .select();
      await ctx.sync();
    });
  }

  async saveSettings(s) {
    Office.context.document.settings.set(SETTINGS_KEY, JSON.stringify(s));
    await new Promise((resolve) => Office.context.document.settings.saveAsync(() => resolve()));
  }

  /** Creates a new sheet holding a GanttTasks table filled with `rows`. */
  async createSheet(rows) {
    await Excel.run(async (ctx) => {
      const existing = ctx.workbook.tables.getItemOrNullObject(TABLE_NAME);
      const sheets = ctx.workbook.worksheets.load("items/name");
      await ctx.sync();
      if (!existing.isNullObject) throw new Error(`This workbook already has a ${TABLE_NAME} table.`);
      const names = new Set(sheets.items.map((s) => s.name.toLowerCase()));
      let name = "Gantt";
      for (let k = 2; names.has(name.toLowerCase()); k++) name = `Gantt ${k}`;
      const sheet = ctx.workbook.worksheets.add(name);

      const keys = ["id", "name", "level", "duration", "preds", "fixedStart", "pct", "start", "finish"];
      const values = [
        keys.map((k) => COLUMNS[k][0]),
        ...rows.map((r) => [r.id, r.name, r.level, r.duration, r.preds, "", r.pct, "", ""]),
      ];
      const range = sheet.getRangeByIndexes(0, 0, values.length, keys.length);
      sheet.getRangeByIndexes(1, 4, rows.length, 1).numberFormat = rows.map(() => ["@"]);
      sheet.getRangeByIndexes(1, 6, rows.length, 1).numberFormat = rows.map(() => ["0%"]);
      sheet.getRangeByIndexes(1, 5, rows.length, 1).numberFormat = rows.map(() => [DATE_FORMAT]);
      range.values = values;
      const table = sheet.tables.add(range, true);
      table.name = TABLE_NAME;
      table.style = "TableStyleLight9";
      sheet.freezePanes.freezeRows(1);
      range.format.autofitColumns();
      sheet.getRange("B:B").format.columnWidth = 260;
      sheet.getRange("F:F").format.columnWidth = 110;
      sheet.getRange("H:I").format.columnWidth = 110;
      sheet.activate();
      await ctx.sync();
    });
  }

  canInsertImage() {
    return Office.context.requirements.isSetSupported("ExcelApi", "1.9");
  }

  /** Places a PNG of the chart next to the table, replacing the previous snapshot. */
  async insertImage(base64, widthPx) {
    await Excel.run(async (ctx) => {
      const table = ctx.workbook.tables.getItem(this.tableName);
      const sheet = table.worksheet;
      const shapes = sheet.shapes.load("items/name");
      const area = table.getRange().load("left, top, width");
      await ctx.sync();
      shapes.items.filter((s) => s.name === "Gantt chart").forEach((s) => s.delete());
      const img = sheet.shapes.addImage(base64);
      img.name = "Gantt chart";
      img.lockAspectRatio = true;
      img.width = widthPx * 0.75; // px → points
      img.left = area.left + area.width + 18;
      img.top = area.top;
      await ctx.sync();
    });
  }
}

function readDocSettings() {
  try {
    const raw = Office.context.document.settings.get(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------

const DEMO_KEY = "excel-gantt-demo";

export class MemorySource {
  kind = "demo";

  constructor() {
    const saved = storage.get(DEMO_KEY);
    this.rows = saved?.rows ?? sampleRows();
    this.settings = saved?.settings ?? null;
    this.rows.forEach((r, i) => (r.row = i));
  }

  persist() {
    storage.set(DEMO_KEY, { rows: this.rows, settings: this.settings });
  }

  async load() {
    return { rows: this.rows.map((r) => ({ ...r })), settings: this.settings, where: "Demo plan (not connected to Excel)" };
  }

  onChange() {}

  async setCells(changes) {
    for (const { index, key, value } of changes) this.rows[index][key] = value;
    this.persist();
  }

  async writeSchedule() {}
  async select() {}

  async saveSettings(s) {
    this.settings = s;
    this.persist();
  }

  async createSheet(rows) {
    this.rows = rows.map((r, i) => ({ ...r, row: i }));
    this.persist();
  }

  canInsertImage() {
    return false;
  }
}

export const storage = {
  get(key) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode etc. — the pane still works, it just won't remember */
    }
  },
};
