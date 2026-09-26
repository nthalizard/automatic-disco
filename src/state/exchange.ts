/*  Export / import of jobs as JSON files.
    File shape: { format: "shaft-alignment-jobs", version: 1, exportedAt, jobs: Job[], presets?: TolPreset[] }.
    Import is defensive: unknown fields are dropped, missing ones take blank defaults, and a
    job that can't be read is skipped with a reason rather than failing the whole file. */

import type { TolPreset } from "./presets";
import { blankInputs, blankMeta, newId, type Job, type JobInputs, type JobMeta, type ReadingSet, type SignedReading } from "./job";

export const FILE_FORMAT = "shaft-alignment-jobs";
export const FILE_VERSION = 1;

export function serializeJobs(jobs: Job[], presets: TolPreset[] = [], now = new Date()): string {
  const file = { format: FILE_FORMAT, version: FILE_VERSION, exportedAt: now.toISOString(), jobs, ...(presets.length ? { presets } : {}) };
  return JSON.stringify(file, null, 2);
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, d: string) => (typeof v === "string" ? v : typeof v === "number" && isFinite(v) ? String(v) : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const isoDate = (v: unknown, d: string) => (typeof v === "string" && !isNaN(Date.parse(v)) ? v : d);

function reading(v: unknown, d: SignedReading): SignedReading {
  return isObj(v) ? { mag: str(v.mag, d.mag), pos: bool(v.pos, d.pos) } : d;
}

function readSet(v: unknown): ReadingSet | null {
  if (!isObj(v)) return null;
  const z = { mag: "0", pos: true };
  return { voff: reading(v.voff, z), vgap: reading(v.vgap, z), hoff: reading(v.hoff, z), hgap: reading(v.hgap, z) };
}

function readInputs(v: unknown): JobInputs {
  const d = blankInputs();
  if (!isObj(v)) return d;
  let tol: JobInputs["tol"] = null;
  if (isObj(v.tol)) {
    tol = {};
    for (const k of ["eo", "ea", "ao", "aa"] as const) if (v.tol[k] != null) tol[k] = str(v.tol[k], "");
  }
  return {
    unit: v.unit === "met" ? "met" : "imp",
    D: str(v.D, d.D), L1: str(v.L1, d.L1), Ls: str(v.Ls, d.Ls), dbse: str(v.dbse, d.dbse), rpm: str(v.rpm, d.rpm),
    voff: reading(v.voff, d.voff), vgap: reading(v.vgap, d.vgap), hoff: reading(v.hoff, d.hoff), hgap: reading(v.hgap, d.hgap),
    hflip: bool(v.hflip, d.hflip), showTargets: bool(v.showTargets, d.showTargets),
    tvoff: reading(v.tvoff, d.tvoff), tvgap: reading(v.tvgap, d.tvgap), thoff: reading(v.thoff, d.thoff), thgap: reading(v.thgap, d.thgap),
    tol,
    tolSource: tol && typeof v.tolSource === "string" ? v.tolSource : null,
    asLeft: readSet(v.asLeft),
    stage: v.stage === "left" && isObj(v.asLeft) ? "left" : "found",
  };
}

function readMeta(v: unknown): JobMeta {
  const d = blankMeta();
  if (!isObj(v)) return d;
  return {
    name: str(v.name, d.name), site: str(v.site, d.site), technician: str(v.technician, d.technician),
    notes: str(v.notes, d.notes), movable: str(v.movable, d.movable), stationary: str(v.stationary, d.stationary),
  };
}

/** Normalize one stored or imported job onto the current shape; null if it has no inputs. */
export function readJob(raw: unknown, fallbackDate = new Date().toISOString()): Job | null {
  if (!isObj(raw) || !isObj(raw.inputs)) return null;
  const createdAt = isoDate(raw.createdAt, fallbackDate);
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newId(),
    createdAt,
    updatedAt: isoDate(raw.updatedAt, createdAt),
    meta: readMeta(raw.meta),
    inputs: readInputs(raw.inputs),
  };
}

function readPreset(v: unknown, fallbackDate: string): TolPreset | null {
  if (!isObj(v) || typeof v.name !== "string" || !v.name.trim()) return null;
  const n = (x: unknown) => (typeof x === "number" && isFinite(x) && x > 0 ? x : NaN);
  const p = { eo: n(v.eo), ao: n(v.ao), ea: n(v.ea), aa: n(v.aa) };
  if (Object.values(p).some(isNaN)) return null;
  return { id: typeof v.id === "string" && v.id ? v.id : newId(), name: v.name.trim(), ...p, updatedAt: isoDate(v.updatedAt, fallbackDate) };
}

export interface ParseResult { jobs: Job[]; presets: TolPreset[]; skipped: string[] }

/** Read an exported file. Throws only if the file isn't a job export at all. */
export function parseJobFile(text: string, now = new Date()): ParseResult {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error("Not a valid JSON file."); }
  // accept a bare job or a bare array too, in case someone hand-edits
  const list: unknown =
    isObj(data) && data.format === FILE_FORMAT ? data.jobs :
    Array.isArray(data) ? data :
    isObj(data) && isObj(data.inputs) ? [data] : undefined;
  if (isObj(data) && typeof data.version === "number" && data.version > FILE_VERSION)
    throw new Error("This file was made by a newer version of the app.");
  if (!Array.isArray(list)) throw new Error("This file doesn't contain alignment jobs.");

  const t = now.toISOString();
  const jobs: Job[] = [];
  const skipped: string[] = [];
  list.forEach((raw, i) => {
    const j = readJob(raw, t);
    if (j) jobs.push(j); else skipped.push(`Entry ${i + 1}: no readings`);
  });
  const presets: TolPreset[] = [];
  if (isObj(data) && Array.isArray(data.presets)) {
    data.presets.forEach((raw, i) => {
      const p = readPreset(raw, t);
      if (p) presets.push(p); else skipped.push(`Preset ${i + 1}: invalid limits`);
    });
  }
  return { jobs, presets, skipped };
}

export interface MergePlan<T = Job> { toSave: T[]; added: number; updated: number; unchanged: number }

/** New ids are added; an existing id is replaced only if the imported copy was edited more recently. */
export function planImport<T extends { id: string; updatedAt: string }>(existing: T[], incoming: T[]): MergePlan<T> {
  const byId = new Map(existing.map((j) => [j.id, j]));
  const plan: MergePlan<T> = { toSave: [], added: 0, updated: 0, unchanged: 0 };
  for (const j of incoming) {
    const cur = byId.get(j.id);
    if (!cur) { plan.toSave.push(j); plan.added++; }
    else if (j.updatedAt > cur.updatedAt) { plan.toSave.push(j); plan.updated++; }
    else plan.unchanged++;
    byId.set(j.id, cur && j.updatedAt <= cur.updatedAt ? cur : j);
  }
  return plan;
}

/** File-name-safe slug. */
export const slug = (s: string) =>
  s.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").toLowerCase().slice(0, 50) || "job";

export function exportFileName(jobs: Job[], now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return jobs.length === 1 ? `alignment-${slug(jobs[0].meta.name)}-${day}.json` : `alignment-jobs-${day}.json`;
}

/** Trigger a browser download of text content. */
export function downloadText(text: string, fileName: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
