import { describe, expect, it } from "vitest";
import { grade, interpTol, TOL_TABLE, worstGrade } from "./tolerance";

describe("interpTol", () => {
  it("returns exact table rows", () => {
    for (const row of TOL_TABLE) {
      const { rpm, ...tol } = row;
      expect(interpTol(rpm)).toEqual(tol);
    }
  });

  it("clamps below the slowest and above the fastest speed", () => {
    expect(interpTol(100)).toEqual(interpTol(600));
    expect(interpTol(20000)).toEqual(interpTol(7200));
    expect(interpTol(NaN)).toEqual(interpTol(600));
  });

  it("interpolates linearly between rows", () => {
    const t = interpTol(1500); // halfway 1200 → 1800
    expect(t.eo).toBeCloseTo(2.25);
    expect(t.ea).toBeCloseTo(0.4);
    expect(t.ao).toBeCloseTo(3.5);
    expect(t.aa).toBeCloseTo(0.65);
  });
});

describe("grade", () => {
  it("uses magnitude and inclusive limits", () => {
    expect(grade(1, 1, 2)).toBe("excellent");
    expect(grade(-1, 1, 2)).toBe("excellent");
    expect(grade(1.5, 1, 2)).toBe("acceptable");
    expect(grade(-2, 1, 2)).toBe("acceptable");
    expect(grade(2.01, 1, 2)).toBe("out");
  });

  it("worstGrade picks the worst", () => {
    expect(worstGrade([])).toBe("excellent");
    expect(worstGrade(["excellent", "acceptable"])).toBe("acceptable");
    expect(worstGrade(["acceptable", "out", "excellent"])).toBe("out");
  });
});
