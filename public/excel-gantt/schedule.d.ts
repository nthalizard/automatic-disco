// Types for schedule.js so the unit tests (src/gantt) type-check against it.

export const HOUR: number;
export const DAY: number;
export function serialToMs(serial: number): number;
export function msToSerial(ms: number): number;
export function nowNaive(d?: Date): number;
export function parseDateValue(v: unknown): number | null;
export function parseDuration(v: unknown, hoursPerDay?: number): number | null;
export function parsePercent(v: unknown): number;

export interface CalendarSettings {
  hoursPerDay?: number;
  shiftStart?: number;
  workDays?: boolean[];
}

export class WorkCalendar {
  constructor(settings: CalendarSettings, originMs: number);
  hoursPerDay: number;
  shiftStart: number;
  workDays: boolean[];
  continuous: boolean;
  origin: number;
  nextWorking(ms: number): number;
  toDate(hours: number, atEnd?: boolean): number;
  toWork(ms: number): number;
  gaps(from: number, to: number): Array<[number, number]>;
}

export type LinkType = "FS" | "SS" | "FF";
export interface Link {
  id: string;
  type: LinkType;
  lag: number;
}
export function parsePredecessors(text: unknown, hoursPerDay?: number): { links: Link[]; errors: string[] };
export function formatPredecessors(links: Link[]): string;
export function normalizeId(v: unknown): string;

export interface RowInput {
  id?: unknown;
  name?: unknown;
  level?: unknown;
  duration?: unknown;
  preds?: unknown;
  fixedStart?: number | null;
  pct?: unknown;
}

export interface ScheduledTask {
  index: number;
  id: string;
  name: string;
  level: number;
  duration: number;
  links: Link[];
  fixedStart: number | null;
  pct: number;
  parent: number;
  children: number[];
  isSummary: boolean;
  errors: string[];
  es: number;
  ef: number;
  ls: number;
  lf: number;
  float: number;
  critical: boolean;
  start: number;
  finish: number;
  pushedBy?: string[];
}

export interface ScheduleResult {
  tasks: ScheduledTask[];
  links: Array<{ from: number; to: number; type: LinkType; lag: number }>;
  calendar: WorkCalendar;
  projectStart: number;
  projectFinish: number;
  totalWork: number;
}

export function schedule(rows: RowInput[], settings: CalendarSettings & { projectStart: number }): ScheduleResult;
export function sequentialPredecessors(rows: RowInput[]): string[];
export function wouldCreateCycle(rows: RowInput[], fromIndex: number, toIndex: number): boolean;
export function idOf(rows: RowInput[], i: number): string;
export function addPredecessor(text: unknown, id: string): string;
