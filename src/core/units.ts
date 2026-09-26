/*  Internal math is imperial: thou (0.001 in), inch, thou/in.
    Metric display: mm for lengths and displacements, mm/m for slope (numerically equal to thou/in). */

export type Unit = "imp" | "met";

export const MM_PER_INCH = 25.4;
export const MM_PER_THOU = 0.0254;

/** Convert a displayed length (in or mm) to inches. */
export const lenToIn = (v: number, unit: Unit) => (unit === "met" ? v / MM_PER_INCH : v);
/** Convert a displayed small displacement (thou or mm) to thou. */
export const smallToThou = (v: number, unit: Unit) => (unit === "met" ? v / MM_PER_THOU : v);
/** Convert inches to the display length unit. */
export const inToLen = (inch: number, unit: Unit) => (unit === "met" ? inch * MM_PER_INCH : inch);
/** Convert thou to the display small-displacement unit. */
export const thouToSmall = (thou: number, unit: Unit) => (unit === "met" ? thou * MM_PER_THOU : thou);

/** Rescale a user-typed string by factor f, rounded to d decimals; non-numeric input is left untouched. */
export function convertText(s: string, f: number, d: number): string {
  const v = parseFloat(s);
  return isFinite(v) ? String(+(v * f).toFixed(d)) : s;
}
