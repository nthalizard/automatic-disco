/** Parse a user-typed number; anything non-numeric is treated as 0. */
export const num = (s: string): number => { const v = parseFloat(s); return isFinite(v) ? v : 0; };
export const fmt = (x: number, d = 1): string => (isFinite(x) ? x.toFixed(d) : "—");
export const sgn = (x: number, d = 1): string => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(d);
