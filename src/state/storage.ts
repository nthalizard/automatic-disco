/*  Job and tolerance-preset storage in the browser's IndexedDB (object stores keyed by id).
    If IndexedDB is unavailable (some private-browsing modes), jobs live in memory for the
    session only and `persistent` is false so the UI can warn. */

import type { Job } from "./job";
import type { TolPreset } from "./presets";

export interface JobStore {
  persistent: boolean;
  list(): Promise<Job[]>;
  put(job: Job): Promise<void>;
  remove(id: string): Promise<void>;
  listPresets(): Promise<TolPreset[]>;
  putPreset(p: TolPreset): Promise<void>;
  removePreset(id: string): Promise<void>;
}

const DB_NAME = "shaft-alignment";
const STORE = "jobs";
const PRESETS = "presets";

const req = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 2);
    r.onupgradeneeded = () => {
      const db = r.result;
      // v1: jobs · v2: tolerance presets
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(PRESETS)) db.createObjectStore(PRESETS, { keyPath: "id" });
    };
    r.onsuccess = () => {
      // let a newer version of the app (in another tab) upgrade the database
      r.result.onversionchange = () => r.result.close();
      resolve(r.result);
    };
    r.onerror = () => reject(r.error);
    // onblocked: an older tab still has the database open; the open completes once it closes
  });
}

function idbStore(db: IDBDatabase): JobStore {
  const tx = (mode: IDBTransactionMode, store = STORE) => db.transaction(store, mode).objectStore(store);
  return {
    persistent: true,
    list: () => req(tx("readonly").getAll() as IDBRequest<Job[]>),
    put: async (job) => { await req(tx("readwrite").put(job)); },
    remove: async (id) => { await req(tx("readwrite").delete(id)); },
    listPresets: () => req(tx("readonly", PRESETS).getAll() as IDBRequest<TolPreset[]>),
    putPreset: async (p) => { await req(tx("readwrite", PRESETS).put(p)); },
    removePreset: async (id) => { await req(tx("readwrite", PRESETS).delete(id)); },
  };
}

export function memoryStore(): JobStore {
  const m = new Map<string, Job>();
  const pm = new Map<string, TolPreset>();
  return {
    persistent: false,
    list: async () => [...m.values()].map((j) => structuredClone(j)),
    put: async (job) => { m.set(job.id, structuredClone(job)); },
    remove: async (id) => { m.delete(id); },
    listPresets: async () => [...pm.values()].map((p) => ({ ...p })),
    putPreset: async (p) => { pm.set(p.id, { ...p }); },
    removePreset: async (id) => { pm.delete(id); },
  };
}

export async function openJobStore(): Promise<JobStore> {
  try {
    if (typeof indexedDB === "undefined") return memoryStore();
    const store = idbStore(await openDb());
    // Ask the browser not to evict our data under storage pressure (best effort, no prompt on most browsers).
    try { await navigator.storage?.persist?.(); } catch { /* ignore */ }
    return store;
  } catch {
    return memoryStore();
  }
}

/** Newest-edited first. */
export const sortJobs = (jobs: Job[]) => [...jobs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

const LAST_KEY = "sa.lastJobId";
export function getLastJobId(): string | null {
  try { return localStorage.getItem(LAST_KEY); } catch { return null; }
}
export function setLastJobId(id: string) {
  try { localStorage.setItem(LAST_KEY, id); } catch { /* ignore */ }
}
