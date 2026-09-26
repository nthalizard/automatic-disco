/*  Tolerance presets: named limit sets (OEM / site specs) that can be applied to any job.
    Stored in imperial (thou, thou/in) so they work in either unit system. Applying a preset
    copies its values into the job's overrides, so a job and its report stay self-contained. */

import type { TolKey } from "../core/tolerance";
import { smallToThou, thouToSmall, type Unit } from "../core/units";
import { num } from "../core/format";
import { newId, type TolOverride } from "./job";

export interface TolPreset {
  id: string;
  name: string;
  /** excellent / acceptable offset, thou */
  eo: number; ao: number;
  /** excellent / acceptable angularity, thou/in (= mm/m) */
  ea: number; aa: number;
  updatedAt: string;
}

export interface Limits { excOff: number; accOff: number; excAng: number; accAng: number }

export function createPreset(name: string, lim: Limits, now = new Date()): TolPreset {
  return { id: newId(), name: name.trim(), eo: lim.excOff, ao: lim.accOff, ea: lim.excAng, aa: lim.accAng, updatedAt: now.toISOString() };
}

const round = (x: number, d: number) => String(+x.toFixed(d));

/** Preset → job tolerance overrides, as text in the job's display unit. */
export function presetToOverride(p: TolPreset, unit: Unit): NonNullable<TolOverride> {
  const off = (thou: number) => round(thouToSmall(thou, unit), unit === "met" ? 4 : 3);
  return { eo: off(p.eo), ao: off(p.ao), ea: round(p.ea, 3), aa: round(p.aa, 3) };
}

/** Does the job's override still hold exactly this preset's values? */
export function overrideMatches(tol: TolOverride, p: TolPreset, unit: Unit): boolean {
  if (!tol) return false;
  const want = presetToOverride(p, unit);
  return (Object.keys(want) as TolKey[]).every((k) => tol[k] != null && Math.abs(num(tol[k]!) - num(want[k]!)) < 1e-9);
}

/** Current job limits in imperial, from overrides (display unit) or the auto table. */
export function overrideToLimits(tol: TolOverride, unit: Unit, auto: { eo: number; ao: number; ea: number; aa: number }): Limits {
  return {
    excOff: tol?.eo != null ? smallToThou(num(tol.eo), unit) : auto.eo,
    accOff: tol?.ao != null ? smallToThou(num(tol.ao), unit) : auto.ao,
    excAng: tol?.ea != null ? num(tol.ea) : auto.ea,
    accAng: tol?.aa != null ? num(tol.aa) : auto.aa,
  };
}

/** Check a preset's limits make sense; returns a problem description or null. */
export function presetProblem(lim: Limits): string | null {
  const vals = [lim.excOff, lim.accOff, lim.excAng, lim.accAng];
  if (vals.some((v) => !isFinite(v) || v <= 0)) return "All four limits must be greater than zero.";
  if (lim.excOff > lim.accOff || lim.excAng > lim.accAng) return "Excellent limits must not be larger than acceptable limits.";
  return null;
}

export const sortPresets = (ps: TolPreset[]) => [...ps].sort((a, b) => a.name.localeCompare(b.name));
