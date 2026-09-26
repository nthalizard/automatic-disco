import type { Grade } from "../core/tolerance";
import { C } from "../theme";

export const gColor: Record<Grade, string> = { excellent: C.ok, acceptable: C.warn, out: C.bad };
export const gLabel: Record<Grade, string> = { excellent: "EXCELLENT", acceptable: "ACCEPTABLE", out: "OUT OF TOL" };
