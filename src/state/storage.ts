/*  Job storage in the browser's IndexedDB (one object store, keyed by job id).
    If IndexedDB is unavailable (some private-browsing modes), jobs live in memory for the
    session only and `persistent` is false so the UI can warn. */

import type { Job } from "./job";

export interface JobStore {
  persistent: boolean;
  list(): Promise<Job[]>;
  put(job: Job): Promise<void>;
  remove(id: string): Promise<void>;
}

const DB_NAME = "shaft-alignment";
const STORE = "jobs";

const req = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(STORE, { keyPath: "id" }); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error("database blocked"));
  });
}

function idbStore(db: IDBDatabase): JobStore {
  const tx = (mode: IDBTransactionMode) => db.transaction(STORE, mode).objectStore(STORE);
  return {
    persistent: true,
    list: () => req(tx("readonly").getAll() as IDBRequest<Job[]>),
    put: async (job) => { await req(tx("readwrite").put(job)); },
    remove: async (id) => { await req(tx("readwrite").delete(id)); },
  };
}

export function memoryStore(): JobStore {
  const m = new Map<string, Job>();
  return {
    persistent: false,
    list: async () => [...m.values()].map((j) => structuredClone(j)),
    put: async (job) => { m.set(job.id, structuredClone(job)); },
    remove: async (id) => { m.delete(id); },
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
