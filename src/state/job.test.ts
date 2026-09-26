import { describe, expect, it } from "vitest";
import { convertInputs, createJob, duplicateJob, exampleInputs, exampleMeta } from "./job";
import { evaluate } from "./evaluate";

describe("convertInputs", () => {
  it("is a no-op for the same unit", () => {
    const inp = exampleInputs();
    expect(convertInputs(inp, "imp")).toBe(inp);
  });

  it("converts to metric and back without changing the results", () => {
    const imp = { ...exampleInputs(), tol: { eo: "0.5" } };
    const met = convertInputs(imp, "met");
    expect(met.unit).toBe("met");
    expect(met.D).toBe("152.4");
    expect(met.voff).toEqual({ mag: "1.417", pos: false });
    expect(met.tol).toBeNull();
    const back = convertInputs(met, "imp");
    expect(back.D).toBe("6");
    expect(back.voff.mag).toBe("55.8");

    // metric rounding (3 decimals of mm) is ~0.02 thou — results agree to that
    const a = evaluate({ ...imp, tol: null }).R.feet, b = evaluate(met).R.feet;
    expect(b.frontV).toBeCloseTo(a.frontV, 0);
    expect(b.backH).toBeCloseTo(a.backH, 0);
  });
});

describe("jobs", () => {
  it("duplicate gets a new id, copied inputs, and a (copy) name", () => {
    const j = createJob(exampleMeta(), exampleInputs(), new Date("2026-01-01T00:00:00Z"));
    const d = duplicateJob(j, new Date("2026-02-01T00:00:00Z"));
    expect(d.id).not.toBe(j.id);
    expect(d.meta.name).toBe(`${j.meta.name} (copy)`);
    expect(d.inputs).toEqual(j.inputs);
    expect(d.inputs.voff).not.toBe(j.inputs.voff);
    expect(d.createdAt).toBe("2026-02-01T00:00:00.000Z");
  });
});

describe("evaluate", () => {
  it("matches the core math for the example job", () => {
    const { R, overall } = evaluate(exampleInputs());
    expect(R.feet.frontV).toBeCloseTo(717.8094, 3);
    expect(R.feet.backH).toBeCloseTo(2104.85862, 3);
    expect(overall).toBe("out");
  });

  it("aligned readings grade excellent", () => {
    expect(evaluate({ ...exampleInputs(), voff: { mag: "0", pos: true }, vgap: { mag: "0", pos: true },
      hoff: { mag: "0", pos: true }, hgap: { mag: "0", pos: true } }).overall).toBe("excellent");
  });

  it("tolerance overrides are read in the display unit", () => {
    const met = { ...convertInputs(exampleInputs(), "met"), tol: { ao: "0.0254" } };
    expect(evaluate(met).lim.accOff).toBeCloseTo(1);
  });
});
