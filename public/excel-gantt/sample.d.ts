import type { RowInput } from "./schedule.js";

export function sampleRows(): Array<RowInput & { id: string; name: string; level: number; preds: string; pct: number }>;
export function nextMondayMorning(now?: Date): number;
