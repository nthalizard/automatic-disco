/*  Job and tolerance-preset storage in the browser's IndexedDB (object stores keyed by id).
    Records are encrypted with the password lock's key (see lock.ts): each is stored as
    { id, iv, ct }. Records written before the lock existed are plain and get encrypted when
    the password is first set.
    If IndexedDB is unavailable (some private-browsing modes), jobs live in memory for the
    session only and `persistent` is false so the UI can warn. */

import type { Job } from "./job";
import { isSealed, seal, unseal, type LockMeta, type Sealed } from "./lock";
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
const META = "meta";
const DATA_STORES = [STORE, PRESETS] as const;

type EncRecord = { id: string } & Sealed;

const req = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 3);
    r.onupgradeneeded = () => {
      const db = r.result;
      // v1: jobs · v2: tolerance presets · v3: meta (password lock)
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(PRESETS)) db.createObjectStore(PRESETS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "id" });
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

/** The device database, or null if the browser has no usable IndexedDB. */
export async function openDevice(): Promise<IDBDatabase | null> {
  try {
    if (typeof indexedDB === "undefined") return null;
    const db = await openDb();
    // Ask the browser not to evict our data under storage pressure (best effort, no prompt on most browsers).
    try { await navigator.storage?.persist?.(); } catch { /* ignore */ }
    return db;
  } catch {
    return null;
  }
}

export async function getLock(db: IDBDatabase): Promise<LockMeta | null> {
  const m = await req(db.transaction(META, "readonly").objectStore(META).get("lock"));
  return (m as LockMeta | undefined) ?? null;
}

/** How many records exist that were saved before the lock (still plain). */
export async function countPlainRecords(db: IDBDatabase): Promise<number> {
  let n = 0;
  for (const s of DATA_STORES) {
    const all = await req(db.transaction(s, "readonly").objectStore(s).getAll());
    n += all.filter((r) => !isSealed(r)).length;
  }
  return n;
}

/** Set the first password: encrypt any plain records and store the lock, in one transaction. */
export async function setupLock(db: IDBDatabase, meta: LockMeta, key: CryptoKey): Promise<void> {
  const plain: Record<string, { id: string }[]> = {};
  for (const s of DATA_STORES) {
    plain[s] = (await req(db.transaction(s, "readonly").objectStore(s).getAll())).filter((r) => !isSealed(r));
  }
  // encrypt everything first: a transaction can't stay open across the async crypto calls
  const sealed: Record<string, EncRecord[]> = {};
  for (const s of DATA_STORES) sealed[s] = await Promise.all(plain[s].map(async (r) => ({ id: r.id, ...(await seal(key, r)) })));
  const tx = db.transaction([...DATA_STORES, META], "readwrite");
  for (const s of DATA_STORES) for (const r of sealed[s]) tx.objectStore(s).put(r);
  tx.objectStore(META).put(meta);
  await done(tx);
}

/** Change password: re-encrypt every record and replace the lock, all-or-nothing. */
export async function rekey(db: IDBDatabase, oldKey: CryptoKey, meta: LockMeta, newKey: CryptoKey): Promise<void> {
  const sealed: Record<string, EncRecord[]> = {};
  for (const s of DATA_STORES) {
    const all = await req(db.transaction(s, "readonly").objectStore(s).getAll());
    sealed[s] = await Promise.all(all.map(async (r) => {
      const value = isSealed(r) ? await unseal(oldKey, r) : r;
      return { id: (r as { id: string }).id, ...(await seal(newKey, value)) };
    }));
  }
  const tx = db.transaction([...DATA_STORES, META], "readwrite");
  for (const s of DATA_STORES) for (const r of sealed[s]) tx.objectStore(s).put(r);
  tx.objectStore(META).put(meta);
  await done(tx);
}

/** Forgotten password: delete every job, preset and the lock on this device. */
export async function eraseDevice(db: IDBDatabase): Promise<void> {
  const tx = db.transaction([...DATA_STORES, META], "readwrite");
  for (const s of [...DATA_STORES, META]) tx.objectStore(s).clear();
  await done(tx);
  try { localStorage.removeItem(LAST_KEY); } catch { /* ignore */ }
}

/** Jobs/presets store over the device database, encrypting every record with `key.current`
    (a ref, so a password change can swap the key without replacing the store). */
export function encryptedStore(db: IDBDatabase, key: { current: CryptoKey }): JobStore {
  const os = (store: string, mode: IDBTransactionMode) => db.transaction(store, mode).objectStore(store);
  const list = async <T>(store: string): Promise<T[]> => {
    const all = await req(os(store, "readonly").getAll());
    // plain records only exist if setup was interrupted; read them rather than lose them
    return Promise.all(all.map((r) => (isSealed(r) ? unseal<T>(key.current, r) : (r as T))));
  };
  const put = async (store: string, value: { id: string }) => {
    const rec: EncRecord = { id: value.id, ...(await seal(key.current, value)) };
    await req(os(store, "readwrite").put(rec));
  };
  return {
    persistent: true,
    list: () => list<Job>(STORE),
    put: (job) => put(STORE, job),
    remove: async (id) => { await req(os(STORE, "readwrite").delete(id)); },
    listPresets: () => list<TolPreset>(PRESETS),
    putPreset: (p) => put(PRESETS, p),
    removePreset: async (id) => { await req(os(PRESETS, "readwrite").delete(id)); },
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

/** Newest-edited first. */
export const sortJobs = (jobs: Job[]) => [...jobs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

const LAST_KEY = "sa.lastJobId";
export function getLastJobId(): string | null {
  try { return localStorage.getItem(LAST_KEY); } catch { return null; }
}
export function setLastJobId(id: string) {
  try { localStorage.setItem(LAST_KEY, id); } catch { /* ignore */ }
}
