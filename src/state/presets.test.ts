import { describe, expect, it } from "vitest";
import { evaluate } from "./evaluate";
import { parseJobFile, serializeJobs } from "./exchange";
import { convertInputs, exampleInputs } from "./job";
import { createPreset, overrideMatches, overrideToLimits, presetProblem, presetToOverride } from "./presets";

const lim = { excOff: 1.5, accOff: 3, excAng: 0.25, accAng: 0.5 };

describe("tolerance presets", () => {
  it("applies in imperial as typed-looking text", () => {
    const p = createPreset("  Site spec  ", lim);
    expect(p.name).toBe("Site spec");
    expect(presetToOverride(p, "imp")).toEqual({ eo: "1.5", ao: "3", ea: "0.25", aa: "0.5" });
  });

  it("applies in metric with offsets in mm and angles unchanged (thou/in = mm/m)", () => {
    const o = presetToOverride(createPreset("x", lim), "met");
    expect(o).toEqual({ eo: "0.0381", ao: "0.0762", ea: "0.25", aa: "0.5" });
    const back = overrideToLimits(o, "met", { eo: 0, ao: 0, ea: 0, aa: 0 });
    expect(back.excOff).toBeCloseTo(1.5);
    expect(back.accOff).toBeCloseTo(3);
  });

  it("the job's evaluation uses the applied preset", () => {
    const p = createPreset("x", lim);
    for (const unit of ["imp", "met"] as const) {
      const inp = convertInputs(exampleInputs(), unit);
      const e = evaluate({ ...inp, tol: presetToOverride(p, unit), tolSource: p.name });
      expect(e.lim.excOff).toBeCloseTo(1.5);
      expect(e.lim.accAng).toBeCloseTo(0.5);
    }
  });

  it("overrideMatches notices when a cell was edited after applying", () => {
    const p = createPreset("x", lim);
    const o = presetToOverride(p, "imp");
    expect(overrideMatches(o, p, "imp")).toBe(true);
    expect(overrideMatches({ ...o, ao: "3.5" }, p, "imp")).toBe(false);
    expect(overrideMatches(null, p, "imp")).toBe(false);
    expect(overrideMatches(presetToOverride(p, "met"), p, "met")).toBe(true);
  });

  it("rejects zero/negative limits and excellent > acceptable", () => {
    expect(presetProblem(lim)).toBeNull();
    expect(presetProblem({ ...lim, excOff: 0 })).toMatch(/greater than zero/);
    expect(presetProblem({ ...lim, excAng: 0.6 })).toMatch(/not be larger/);
  });

  it("round-trips through export files and skips invalid presets", () => {
    const p = createPreset("OEM A", lim);
    const back = parseJobFile(serializeJobs([], [p]));
    expect(back.presets).toEqual([p]);

    const bad = JSON.stringify({ format: "shaft-alignment-jobs", version: 1, jobs: [],
      presets: [{ name: "neg", eo: -1, ao: 1, ea: 1, aa: 1 }, { eo: 1 }, { ...p, id: "b", name: "ok" }] });
    const r = parseJobFile(bad);
    expect(r.presets.map((x) => x.name)).toEqual(["ok"]);
    expect(r.skipped).toHaveLength(2);
  });

  it("exports without presets omit the key", () => {
    expect(JSON.parse(serializeJobs([])).presets).toBeUndefined();
  });
});
