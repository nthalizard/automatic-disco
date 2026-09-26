import { describe, expect, it } from "vitest";
import { computeAlignment, ZERO_READINGS, type AlignmentInput } from "./alignment";

const base = (over: Partial<AlignmentInput> = {}): AlignmentInput => ({
  couplingDia: 6, frontFoot: 10, backFoot: 30,
  measured: ZERO_READINGS, target: ZERO_READINGS, hflip: false,
  ...over,
});
const vert = (offset: number, gap: number) => ({ vertical: { offset, gap }, horizontal: { offset: 0, gap: 0 } });
const horiz = (offset: number, gap: number) => ({ vertical: { offset: 0, gap: 0 }, horizontal: { offset, gap } });

describe("computeAlignment — sign conventions", () => {
  it("aligned shafts need no moves", () => {
    const r = computeAlignment(base());
    expect(Object.values(r.feet).every((v) => Math.abs(v) < 1e-12)).toBe(true);
  });

  it("movable HIGH (pure offset) → remove the same shims at both feet", () => {
    const r = computeAlignment(base({ measured: vert(10, 0) }));
    expect(r.feet.frontV).toBeCloseTo(-10);
    expect(r.feet.backV).toBeCloseTo(-10);
  });

  it("movable LOW (pure offset) → add shims at both feet", () => {
    const r = computeAlignment(base({ measured: vert(-10, 0) }));
    expect(r.feet.frontV).toBeCloseTo(10);
    expect(r.feet.backV).toBeCloseTo(10);
  });

  it("open at BOTTOM (pure angle) → remove shims, more at the back foot", () => {
    // gap 6 thou on a 6 in coupling = 1 thou/in
    const r = computeAlignment(base({ measured: vert(0, 6) }));
    expect(r.rSlopeV).toBeCloseTo(1);
    expect(r.feet.frontV).toBeCloseTo(-10);
    expect(r.feet.backV).toBeCloseTo(-30);
  });

  it("movable RIGHT → move toward left (negative H) at both feet", () => {
    const r = computeAlignment(base({ measured: horiz(5, 0) }));
    expect(r.feet.frontH).toBeCloseTo(-5);
    expect(r.feet.backH).toBeCloseTo(-5);
  });

  it("hflip reverses the horizontal result and leaves vertical alone", () => {
    const m = { vertical: { offset: 3, gap: 2 }, horizontal: { offset: 5, gap: 4 } };
    const a = computeAlignment(base({ measured: m }));
    const b = computeAlignment(base({ measured: m, hflip: true }));
    expect(b.feet.frontH).toBeCloseTo(-a.feet.frontH);
    expect(b.feet.backH).toBeCloseTo(-a.feet.backH);
    expect(b.feet.frontV).toBeCloseTo(a.feet.frontV);
    expect(b.feet.backV).toBeCloseTo(a.feet.backV);
  });

  it("reading exactly the target leaves zero residual", () => {
    const t = { vertical: { offset: -4, gap: 3 }, horizontal: { offset: 2, gap: -1 } };
    const r = computeAlignment(base({ measured: t, target: t }));
    expect(Object.values(r.feet).every((v) => Math.abs(v) < 1e-12)).toBe(true);
  });

  it("targets shift the correction: target HIGH 5 with movable level → add 5", () => {
    const r = computeAlignment(base({ target: vert(5, 0) }));
    expect(r.feet.frontV).toBeCloseTo(5);
    expect(r.feet.backV).toBeCloseTo(5);
  });
});

describe("computeAlignment — default job (Compressor 1 → Gearbox 2)", () => {
  // Defaults from the original calculator: D 6 in, coupling→front 58.071 in, front→back 101.18 in,
  // V offset 55.8 LOW, V gap 68.4 open TOP, H offset 69.1 LEFT, H gap 76.7 open RIGHT.
  const r = computeAlignment({
    couplingDia: 6, frontFoot: 58.071, backFoot: 58.071 + 101.18,
    measured: { vertical: { offset: -55.8, gap: -68.4 }, horizontal: { offset: -69.1, gap: -76.7 } },
    target: ZERO_READINGS, hflip: false,
  });

  it("residual slopes", () => {
    expect(r.rSlopeV).toBeCloseTo(-11.4, 6);
    expect(r.rSlopeH).toBeCloseTo(-12.783333, 5);
  });

  it("foot corrections", () => {
    expect(r.feet.frontV).toBeCloseTo(717.8094, 3);   // ADD
    expect(r.feet.backV).toBeCloseTo(1871.2614, 3);   // ADD
    expect(r.feet.frontH).toBeCloseTo(811.44095, 3);  // → right
    expect(r.feet.backH).toBeCloseTo(2104.85862, 3);   // → right
  });
});
