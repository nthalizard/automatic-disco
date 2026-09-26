/*  Turn a job's typed inputs into results — shared by the screen and the printed report
    so both always show the same numbers. */

import { computeAlignment, type AlignmentResult, type PlaneReading } from "../core/alignment";
import { fmt, num, sgn } from "../core/format";
import { grade, interpTol, worstGrade, type Grade, type Tolerances } from "../core/tolerance";
import { inToLen, lenToIn, smallToThou, thouToSmall, type Unit } from "../core/units";
import type { JobInputs, SignedReading } from "./job";

/** Display-unit labels and helpers for one unit system. */
export function unitLabels(unit: Unit) {
  const met = unit === "met";
  const smDec = met ? 2 : 1;
  const dS = (thou: number) => thouToSmall(thou, unit);
  return {
    met,
    uLen: met ? "mm" : "in",
    uSm: met ? "mm" : "thou",
    uSl: met ? "mm/m" : "thou/in",
    smDec,
    eps: met ? 0.005 : 0.05,
    /** thou → display small unit */
    dS,
    /** inch → display length unit */
    dL: (inch: number) => inToLen(inch, unit),
    /** signed display of a thou value */
    sgnS: (thou: number, d = smDec) => sgn(dS(thou), d),
  };
}

export interface Evaluation {
  R: AlignmentResult;
  auto: Tolerances;
  /** active limits, imperial (thou, thou/in) */
  lim: { excOff: number; accOff: number; excAng: number; accAng: number };
  gr: { offV: Grade; angV: Grade; offH: Grade; angH: Grade };
  overall: Grade;
}

export function evaluate(inp: JobInputs): Evaluation {
  const { unit, tol } = inp;
  const s = (r: SignedReading) => smallToThou((r.pos ? 1 : -1) * num(r.mag), unit);
  const plane = (off: SignedReading, gap: SignedReading): PlaneReading => ({ offset: s(off), gap: s(gap) });
  const R = computeAlignment({
    couplingDia: lenToIn(num(inp.D), unit),
    frontFoot: lenToIn(num(inp.L1), unit),
    backFoot: lenToIn(num(inp.L1) + num(inp.Ls), unit),
    measured: { vertical: plane(inp.voff, inp.vgap), horizontal: plane(inp.hoff, inp.hgap) },
    target: { vertical: plane(inp.tvoff, inp.tvgap), horizontal: plane(inp.thoff, inp.thgap) },
    hflip: inp.hflip,
  });

  const auto = interpTol(num(inp.rpm));
  const lim = {
    excOff: tol?.eo != null ? smallToThou(num(tol.eo), unit) : auto.eo,
    accOff: tol?.ao != null ? smallToThou(num(tol.ao), unit) : auto.ao,
    excAng: tol?.ea != null ? num(tol.ea) : auto.ea,
    accAng: tol?.aa != null ? num(tol.aa) : auto.aa,
  };
  const gr = {
    offV: grade(R.rOffV, lim.excOff, lim.accOff), angV: grade(R.rSlopeV, lim.excAng, lim.accAng),
    offH: grade(R.rOffH, lim.excOff, lim.accOff), angH: grade(R.rSlopeH, lim.excAng, lim.accAng),
  };
  return { R, auto, lim, gr, overall: worstGrade(Object.values(gr)) };
}

/** Coupling gap readout text for one plane. */
export function gapReadout(rGap: number, ax: "vertical" | "horizontal", unit: Unit) {
  const { dS, eps, smDec } = unitLabels(unit);
  const mag = Math.abs(dS(rGap));
  if (mag < eps) return { val: fmt(mag, smDec), open: "in-line" };
  const open = ax === "vertical" ? (rGap > 0 ? "open btm" : "open top") : (rGap > 0 ? "open left" : "open right");
  return { val: fmt(mag, smDec), open };
}

/** Short foot callouts used on the centerline drawings. */
export function footCallouts(unit: Unit, hflip: boolean) {
  const { dS, eps, smDec } = unitLabels(unit);
  return {
    v: (m: number) => Math.abs(dS(m)) < eps ? "—" : (m > 0 ? "▲ ADD " : "▼ REM ") + fmt(dS(Math.abs(m)), smDec),
    h: (m: number) => {
      if (Math.abs(dS(m)) < eps) return "—";
      const right = m > 0 ? !hflip : hflip;
      return (right ? "▶ " : "◀ ") + fmt(dS(Math.abs(m)), smDec);
    },
  };
}
