/*  A job = one alignment: who/where/what (meta) plus every input on the screen.
    Inputs are stored exactly as typed, in the job's display unit, so reopening a job
    shows the same text the technician entered. */

import type { TolKey } from "../core/tolerance";
import { convertText, MM_PER_INCH, MM_PER_THOU, type Unit } from "../core/units";

/** A signed reading as typed: magnitude text plus which direction button is selected. */
export interface SignedReading { mag: string; pos: boolean }

export type TolOverride = Partial<Record<TolKey, string>> | null;

export interface JobInputs {
  unit: Unit;
  D: string; L1: string; Ls: string; dbse: string; rpm: string;
  voff: SignedReading; vgap: SignedReading; hoff: SignedReading; hgap: SignedReading;
  hflip: boolean;
  showTargets: boolean;
  tvoff: SignedReading; tvgap: SignedReading; thoff: SignedReading; thgap: SignedReading;
  /** per-cell tolerance overrides in display units; null = speed-based */
  tol: TolOverride;
}

export interface JobMeta {
  name: string;
  site: string;
  technician: string;
  notes: string;
  /** movable machine (MTBM) */
  movable: string;
  /** stationary machine */
  stationary: string;
}

export interface Job {
  id: string;
  createdAt: string;
  updatedAt: string;
  meta: JobMeta;
  inputs: JobInputs;
}

const zero = (): SignedReading => ({ mag: "0", pos: true });

export const blankInputs = (): JobInputs => ({
  unit: "imp",
  D: "", L1: "", Ls: "", dbse: "", rpm: "1800",
  voff: zero(), vgap: zero(), hoff: zero(), hgap: zero(),
  hflip: false, showTargets: false,
  tvoff: zero(), tvgap: zero(), thoff: zero(), thgap: zero(),
  tol: null,
});

export const blankMeta = (): JobMeta => ({
  name: "", site: "", technician: "", notes: "", movable: "Movable", stationary: "Stationary",
});

/** The Compressor 1 → Gearbox 2 example the calculator started with. */
export const exampleInputs = (): JobInputs => ({
  ...blankInputs(),
  D: "6", L1: "58.071", Ls: "101.18", dbse: "1", rpm: "5846",
  voff: { mag: "55.8", pos: false }, vgap: { mag: "68.4", pos: false },
  hoff: { mag: "69.1", pos: false }, hgap: { mag: "76.7", pos: false },
});

export const exampleMeta = (): JobMeta => ({
  ...blankMeta(), name: "Example — Compressor 1 → Gearbox 2", movable: "Compressor 1", stationary: "Gearbox 2",
});

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function createJob(meta: JobMeta = blankMeta(), inputs: JobInputs = blankInputs(), now = new Date()): Job {
  const t = now.toISOString();
  return { id: newId(), createdAt: t, updatedAt: t, meta, inputs };
}

export function duplicateJob(job: Job, now = new Date()): Job {
  return createJob({ ...job.meta, name: `${job.meta.name || "Untitled"} (copy)` }, structuredClone(job.inputs), now);
}

/** Convert every typed value to another unit system; tolerance overrides reset to speed-based. */
export function convertInputs(inp: JobInputs, target: Unit): JobInputs {
  if (target === inp.unit) return inp;
  const toMet = target === "met";
  const Lf = toMet ? MM_PER_INCH : 1 / MM_PER_INCH, Sf = toMet ? MM_PER_THOU : 1 / MM_PER_THOU;
  const ld = toMet ? 1 : 3, sd = toMet ? 3 : 1;
  const cvR = (r: SignedReading) => ({ ...r, mag: convertText(r.mag, Sf, sd) });
  return {
    ...inp,
    unit: target,
    D: convertText(inp.D, Lf, toMet ? 2 : 3), L1: convertText(inp.L1, Lf, ld), Ls: convertText(inp.Ls, Lf, ld),
    dbse: convertText(inp.dbse, Lf, toMet ? 2 : 3),
    voff: cvR(inp.voff), vgap: cvR(inp.vgap), hoff: cvR(inp.hoff), hgap: cvR(inp.hgap),
    tvoff: cvR(inp.tvoff), tvgap: cvR(inp.tvgap), thoff: cvR(inp.thoff), thgap: cvR(inp.thgap),
    tol: null,
  };
}
