import { describe, expect, it } from "vitest";
import { evaluate } from "./evaluate";
import { readJob } from "./exchange";
import { blankReadings, convertInputs, createJob, exampleInputs, exampleMeta, readingsFor, type JobInputs } from "./job";

const withLeft = (): JobInputs => ({
  ...exampleInputs(),
  asLeft: { ...blankReadings(), voff: { mag: "1.0", pos: true } },
});

describe("as-found / as-left", () => {
  it("readingsFor picks the stage and falls back to as-found when none recorded", () => {
    const inp = withLeft();
    expect(readingsFor(inp, "found").voff).toEqual({ mag: "55.8", pos: false });
    expect(readingsFor(inp, "left").voff).toEqual({ mag: "1.0", pos: true });
    expect(readingsFor(exampleInputs(), "left").voff).toEqual({ mag: "55.8", pos: false });
  });

  it("evaluate uses the requested stage; default is the stage on screen", () => {
    const inp = withLeft();
    expect(evaluate(inp, "found").R.feet.frontV).toBeCloseTo(717.8094, 3);
    const left = evaluate(inp, "left");
    expect(left.R.feet.frontV).toBeCloseTo(-1);
    expect(left.R.feet.backV).toBeCloseTo(-1);
    // 5846 rpm → offset limits 0.688 exc / 1.188 acc thou
    expect(left.gr.offV).toBe("acceptable");
    expect(left.overall).toBe("acceptable");
    expect(evaluate({ ...inp, stage: "left" }).R.feet.frontV).toBeCloseTo(-1);
  });

  it("unit conversion converts as-left too", () => {
    const met = convertInputs(withLeft(), "met");
    expect(met.asLeft!.voff.mag).toBe("0.025");
    expect(evaluate(met, "left").R.rOffV).toBeCloseTo(evaluate(withLeft(), "left").R.rOffV, 0);
  });

  it("jobs saved before as-left existed load with no as-left", () => {
    const old = createJob(exampleMeta(), exampleInputs()) as unknown as { inputs: Record<string, unknown> };
    delete old.inputs.asLeft; delete old.inputs.stage; delete old.inputs.tolSource;
    const j = readJob(old)!;
    expect(j.inputs.asLeft).toBeNull();
    expect(j.inputs.stage).toBe("found");
    expect(j.inputs.tolSource).toBeNull();
    expect(j.inputs.voff).toEqual({ mag: "55.8", pos: false });
  });

  it("stage 'left' without as-left readings loads as 'found'", () => {
    const j = readJob({ inputs: { ...exampleInputs(), stage: "left", asLeft: null } })!;
    expect(j.inputs.stage).toBe("found");
  });
});
