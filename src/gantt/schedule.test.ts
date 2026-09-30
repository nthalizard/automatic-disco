import { describe, expect, it } from "vitest";
import {
  HOUR,
  WorkCalendar,
  addPredecessor,
  msToSerial,
  parseDateValue,
  parseDuration,
  parsePercent,
  parsePredecessors,
  schedule,
  sequentialPredecessors,
  serialToMs,
  wouldCreateCycle,
} from "../../public/excel-gantt/schedule.js";
import { sampleRows } from "../../public/excel-gantt/sample.js";

const START = Date.UTC(2026, 9, 5, 7); // Mon 5 Oct 2026 07:00
const at = (d: number, h: number, m = 0) => Date.UTC(2026, 9, d, h, m);
const run = (rows: Parameters<typeof schedule>[0], extra = {}) => schedule(rows, { projectStart: START, ...extra });

describe("parsing", () => {
  it("round-trips Excel serials", () => {
    expect(serialToMs(msToSerial(START))).toBe(START);
    expect(parseDateValue(46300.5)).toBe(serialToMs(46300.5));
    expect(parseDateValue("2026-10-05 07:30")).toBe(at(5, 7, 30));
    expect(parseDateValue("")).toBeNull();
  });

  it("reads durations with units", () => {
    expect(parseDuration(3)).toBe(3);
    expect(parseDuration("3 hrs")).toBe(3);
    expect(parseDuration("2d", 10)).toBe(20);
    expect(parseDuration("30 min")).toBe(0.5);
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("soon")).toBeNull();
  });

  it("reads percentages", () => {
    expect(parsePercent(0.5)).toBe(0.5);
    expect(parsePercent(50)).toBe(0.5);
    expect(parsePercent("75%")).toBe(0.75);
    expect(parsePercent("")).toBe(0);
  });

  it("reads predecessor lists", () => {
    const { links, errors } = parsePredecessors("3, 5SS+2h; 7FF-1d, 9+30m", 10);
    expect(errors).toEqual([]);
    expect(links).toEqual([
      { id: "3", type: "FS", lag: 0 },
      { id: "5", type: "SS", lag: 2 },
      { id: "7", type: "FF", lag: -10 },
      { id: "9", type: "FS", lag: 0.5 },
    ]);
    expect(parsePredecessors("4.0").links[0].id).toBe("4");
    expect(parsePredecessors("3+x").errors).toHaveLength(1);
  });

  it("adds a predecessor once", () => {
    expect(addPredecessor("", "4")).toBe("4");
    expect(addPredecessor("2", "4")).toBe("2, 4");
    expect(addPredecessor("2, 4SS", "4")).toBe("2, 4SS");
  });
});

describe("WorkCalendar", () => {
  it("is plain clock arithmetic when working round the clock", () => {
    const cal = new WorkCalendar({ hoursPerDay: 24 }, START);
    expect(cal.continuous).toBe(true);
    expect(cal.toDate(30)).toBe(START + 30 * HOUR);
    expect(cal.toWork(START + 30 * HOUR)).toBe(30);
  });

  it("skips nights and weekends on a day-shift calendar", () => {
    // 07:00–17:00, Mon–Fri
    const cal = new WorkCalendar({ hoursPerDay: 10, shiftStart: 7, workDays: [false, true, true, true, true, true, false] }, START);
    expect(cal.toDate(10, true)).toBe(at(5, 17)); // a finish stays at the end of the shift
    expect(cal.toDate(10)).toBe(at(6, 7)); // a start moves to the next shift
    expect(cal.toDate(55)).toBe(at(12, 12)); // Fri 17:00 + weekend → Mon 07:00 + 5 h
    expect(cal.toWork(at(12, 12))).toBe(55);
    expect(cal.toWork(at(5, 20))).toBe(10); // evening counts nothing
    expect(cal.nextWorking(at(10, 9))).toBe(at(12, 7)); // Saturday → Monday
    expect(cal.gaps(at(5, 0), at(6, 0))).toEqual([
      [at(5, 0), at(5, 7)],
      [at(5, 17), at(6, 0)],
    ]);
  });

  it("handles a night shift that runs past midnight", () => {
    const cal = new WorkCalendar({ hoursPerDay: 12, shiftStart: 19 }, at(5, 19));
    expect(cal.toDate(6)).toBe(at(6, 1));
    expect(cal.toDate(12, true)).toBe(at(6, 7));
    expect(cal.toDate(13)).toBe(at(6, 20));
  });

  it("moves an origin outside working time to the next shift", () => {
    const cal = new WorkCalendar({ hoursPerDay: 8, shiftStart: 8 }, at(5, 3));
    expect(cal.origin).toBe(at(5, 8));
  });
});

describe("schedule", () => {
  it("chains finish-to-start tasks and rolls up summaries", () => {
    const r = run([
      { id: 1, name: "Permit", duration: 0 },
      { id: 2, name: "Strip", level: 0 },
      { id: 3, name: "A", level: 1, duration: 3, preds: "1" },
      { id: 4, name: "B", level: 1, duration: 2, preds: "3" },
      { id: 5, name: "Box up", duration: 4, preds: "2" },
    ]);
    const [permit, strip, a, b, box] = r.tasks;
    expect(permit.finish).toBe(START);
    expect(strip.isSummary).toBe(true);
    expect([a.parent, b.parent]).toEqual([1, 1]);
    expect(a.start).toBe(START);
    expect(b.start).toBe(START + 3 * HOUR);
    expect(strip.start).toBe(START);
    expect(strip.finish).toBe(START + 5 * HOUR);
    expect(strip.duration).toBe(5);
    // a link to a summary waits for everything inside it
    expect(box.start).toBe(START + 5 * HOUR);
    expect(r.projectFinish).toBe(START + 9 * HOUR);
    expect(r.totalWork).toBe(9);
    expect(r.tasks.every((t) => t.errors.length === 0)).toBe(true);
  });

  it("applies SS / FF links and lags", () => {
    const r = run([
      { id: "a", duration: 10 },
      { id: "b", duration: 4, preds: "aSS+2" },
      { id: "c", duration: 3, preds: "aFF" },
      { id: "d", duration: 1, preds: "a-2h" },
    ]);
    const [, b, c, d] = r.tasks;
    expect(b.es).toBe(2);
    expect(c.es).toBe(7);
    expect(c.ef).toBe(10);
    expect(d.es).toBe(8);
  });

  it("finds the critical path and float", () => {
    const r = run([
      { id: 1, duration: 5 },
      { id: 2, duration: 2 },
      { id: 3, duration: 1, preds: "1, 2" },
    ]);
    const [long, short, end] = r.tasks;
    expect(long.critical).toBe(true);
    expect(end.critical).toBe(true);
    expect(short.critical).toBe(false);
    expect(short.float).toBe(3);
  });

  it("honours a fixed start but never ahead of its predecessors", () => {
    const r = run([
      { id: 1, duration: 4 },
      { id: 2, duration: 1, fixedStart: START + 10 * HOUR },
      { id: 3, duration: 1, preds: "1", fixedStart: START + HOUR },
    ]);
    expect(r.tasks[1].start).toBe(START + 10 * HOUR);
    expect(r.tasks[2].start).toBe(START + 4 * HOUR);
    expect(r.tasks[2].pushedBy).toEqual(["1"]);
  });

  it("reports bad references, duplicates and loops without throwing", () => {
    const r = run([
      { id: 1, duration: 1, preds: "3" },
      { id: 2, duration: 1, preds: "99" },
      { id: 3, duration: 1, preds: "1" },
      { id: 3, duration: 1 },
    ]);
    expect(r.tasks[0].errors).toContain("Circular dependency");
    expect(r.tasks[1].errors).toContain('No task with ID "99"');
    expect(r.tasks[3].errors).toContain('Duplicate ID "3"');
  });

  it("rejects links between a summary and its own tasks", () => {
    const r = run([
      { id: 1, name: "Sum" },
      { id: 2, level: 1, duration: 1, preds: "1" },
    ]);
    expect(r.tasks[1].errors[0]).toMatch(/own summary/);
  });

  it("uses row numbers when the ID column is blank", () => {
    const r = run([{ duration: 2 }, { duration: 1, preds: "1" }]);
    expect(r.tasks.map((t) => t.id)).toEqual(["1", "2"]);
    expect(r.tasks[1].es).toBe(2);
  });

  it("schedules on a working calendar", () => {
    const r = run([{ id: 1, duration: 12 }], { hoursPerDay: 10, shiftStart: 7 });
    expect(r.tasks[0].finish).toBe(at(6, 9));
  });
});

describe("helpers", () => {
  it("links leaf rows in order, skipping summaries", () => {
    expect(
      sequentialPredecessors([
        { id: 1 },
        { id: 2, level: 0 },
        { id: 3, level: 1 },
        { id: 4, level: 1 },
        { id: 5, level: 0 },
      ]),
    ).toEqual(["", "", "1", "3", "4"]);
  });

  it("detects a link that would close a loop", () => {
    const rows = [{ id: 1, duration: 1 }, { id: 2, duration: 1, preds: "1" }];
    expect(wouldCreateCycle(rows, 1, 0)).toBe(true);
    expect(wouldCreateCycle(rows, 0, 1)).toBe(false);
  });

  it("sample plan matches the hours in the original schedule", () => {
    const r = run(sampleRows());
    const byName = (n: string) => r.tasks.find((t) => t.name === n)!;
    expect(byName("Disassembly").duration).toBe(25);
    expect(byName("Inspection & cleaning").duration).toBe(4);
    expect(byName("Re Assembly").duration).toBe(49);
    expect(r.totalWork).toBe(78);
    expect(r.tasks.every((t) => t.errors.length === 0)).toBe(true);
  });
});
