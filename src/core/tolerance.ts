/*  Speed-based alignment tolerances (general field guidance for pumps/motors).
    eo/ao = excellent/acceptable offset (thou); ea/aa = excellent/acceptable angularity (thou/in). */

export interface Tolerances { eo: number; ea: number; ao: number; aa: number }
export type TolKey = keyof Tolerances;
export type Grade = "excellent" | "acceptable" | "out";

export const TOL_TABLE: ReadonlyArray<Tolerances & { rpm: number }> = [
  { rpm: 600,  eo: 5.0, ea: 1.0, ao: 9.0, aa: 1.5 },
  { rpm: 900,  eo: 3.0, ea: 0.7, ao: 6.0, aa: 1.0 },
  { rpm: 1200, eo: 2.5, ea: 0.5, ao: 4.0, aa: 0.8 },
  { rpm: 1800, eo: 2.0, ea: 0.3, ao: 3.0, aa: 0.5 },
  { rpm: 3600, eo: 1.0, ea: 0.2, ao: 1.5, aa: 0.3 },
  { rpm: 7200, eo: 0.5, ea: 0.1, ao: 1.0, aa: 0.2 },
];

/** Linearly interpolate tolerances for a given speed, clamped to the ends of the table. */
export function interpTol(rpm: number): Tolerances {
  const t = TOL_TABLE;
  const pick = ({ eo, ea, ao, aa }: Tolerances): Tolerances => ({ eo, ea, ao, aa });
  if (!isFinite(rpm) || rpm <= t[0].rpm) return pick(t[0]);
  if (rpm >= t[t.length - 1].rpm) return pick(t[t.length - 1]);
  let i = 0;
  while (i < t.length - 1 && !(rpm >= t[i].rpm && rpm <= t[i + 1].rpm)) i++;
  const a = t[i], b = t[i + 1], f = (rpm - a.rpm) / (b.rpm - a.rpm);
  const L = (k: TolKey) => a[k] + f * (b[k] - a[k]);
  return { eo: L("eo"), ea: L("ea"), ao: L("ao"), aa: L("aa") };
}

export function grade(mag: number, exc: number, acc: number): Grade {
  mag = Math.abs(mag);
  if (mag <= exc) return "excellent";
  if (mag <= acc) return "acceptable";
  return "out";
}

const rank: Record<Grade, number> = { excellent: 0, acceptable: 1, out: 2 };
/** The worst of several grades. */
export const worstGrade = (grades: Grade[]): Grade =>
  grades.reduce<Grade>((w, g) => (rank[g] > rank[w] ? g : w), "excellent");
