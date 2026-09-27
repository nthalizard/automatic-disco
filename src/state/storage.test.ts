import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createJob, exampleInputs, exampleMeta } from "./job";
import { createLock } from "./lock";
import { createPreset } from "./presets";
import {
  countPlainRecords, encryptedStore, eraseDevice, getLock, memoryStore, openDb, rekey, setupLock, sortJobs,
} from "./storage";

const FAST = 1000;
let db: IDBDatabase;

const raw = (store: string) =>
  new Promise<unknown[]>((res, rej) => {
    const r = db.transaction(store, "readonly").objectStore(store).getAll();
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
const putRaw = (store: string, v: unknown) =>
  new Promise<void>((res, rej) => {
    const r = db.transaction(store, "readwrite").objectStore(store).put(v);
    r.onsuccess = () => res(); r.onerror = () => rej(r.error);
  });

beforeEach(async () => { db = await openDb(); });
afterEach(async () => {
  db.close();
  await new Promise((res) => { const r = indexedDB.deleteDatabase("shaft-alignment"); r.onsuccess = r.onerror = () => res(null); });
});

describe("encrypted device storage", () => {
  it("saves, lists, updates and removes jobs and presets — encrypted at rest", async () => {
    const { meta, key } = await createLock("copper-lathe-rainy-orbit", FAST);
    await setupLock(db, meta, key);
    const store = encryptedStore(db, { current: key });

    const a = createJob({ ...exampleMeta(), name: "Pump P-101A" }, exampleInputs());
    await store.put(a);
    expect(await store.list()).toEqual([a]);
    await store.put({ ...a, meta: { ...a.meta, name: "Edited" } });
    expect((await store.list()).map((j) => j.meta.name)).toEqual(["Edited"]);

    const p = createPreset("Site spec secret", { excOff: 1, accOff: 2, excAng: 0.1, accAng: 0.2 });
    await store.putPreset(p);
    expect(await store.listPresets()).toEqual([p]);

    const stored = JSON.stringify([...(await raw("jobs")), ...(await raw("presets"))]);
    expect(stored).not.toContain("Edited");
    expect(stored).not.toContain("Site spec secret");
    expect(stored).not.toContain("58.071");

    await store.remove(a.id);
    await store.removePreset(p.id);
    expect(await store.list()).toEqual([]);
    expect(await store.listPresets()).toEqual([]);
  });

  it("setting the first password encrypts jobs saved before the lock existed", async () => {
    const old = createJob({ ...exampleMeta(), name: "Saved before lock" }, exampleInputs());
    await putRaw("jobs", old);
    await putRaw("presets", createPreset("Old preset", { excOff: 1, accOff: 2, excAng: 0.1, accAng: 0.2 }));
    expect(await countPlainRecords(db)).toBe(2);
    expect(await getLock(db)).toBeNull();

    const { meta, key } = await createLock("copper-lathe-rainy-orbit", FAST);
    await setupLock(db, meta, key);
    expect(await countPlainRecords(db)).toBe(0);
    expect(JSON.stringify(await raw("jobs"))).not.toContain("Saved before lock");
    expect(await getLock(db)).toEqual(meta);
    expect(await encryptedStore(db, { current: key }).list()).toEqual([old]);
  });

  it("changing the password re-encrypts everything; the old key no longer reads it", async () => {
    const first = await createLock("first-password-123", FAST);
    await setupLock(db, first.meta, first.key);
    const j = createJob(exampleMeta(), exampleInputs());
    await encryptedStore(db, { current: first.key }).put(j);

    const second = await createLock("second-password-456", FAST);
    await rekey(db, first.key, second.meta, second.key);
    expect(await getLock(db)).toEqual(second.meta);
    expect(await encryptedStore(db, { current: second.key }).list()).toEqual([j]);
    await expect(encryptedStore(db, { current: first.key }).list()).rejects.toThrow();
  });

  it("a failed re-encrypt changes nothing", async () => {
    const first = await createLock("first-password-123", FAST);
    await setupLock(db, first.meta, first.key);
    await encryptedStore(db, { current: first.key }).put(createJob());
    const wrong = await createLock("not-the-real-key", FAST), next = await createLock("next-password-789", FAST);
    await expect(rekey(db, wrong.key, next.meta, next.key)).rejects.toThrow();
    expect(await getLock(db)).toEqual(first.meta);
    expect(await encryptedStore(db, { current: first.key }).list()).toHaveLength(1);
  });

  it("erase removes jobs, presets and the lock", async () => {
    const { meta, key } = await createLock("copper-lathe-rainy-orbit", FAST);
    await setupLock(db, meta, key);
    const s = encryptedStore(db, { current: key });
    await s.put(createJob());
    await s.putPreset(createPreset("x", { excOff: 1, accOff: 2, excAng: 0.1, accAng: 0.2 }));
    await eraseDevice(db);
    expect(await getLock(db)).toBeNull();
    expect(await raw("jobs")).toEqual([]);
    expect(await raw("presets")).toEqual([]);
  });
});

describe("memory store", () => {
  it("saves, lists and removes", async () => {
    const s = memoryStore();
    expect(s.persistent).toBe(false);
    const a = createJob();
    await s.put(a);
    expect(await s.list()).toEqual([a]);
    await s.remove(a.id);
    expect(await s.list()).toEqual([]);
  });
});

it("sortJobs puts the most recently edited first", () => {
  const a = { ...createJob(), updatedAt: "2026-01-01T00:00:00Z" };
  const b = { ...createJob(), updatedAt: "2026-03-01T00:00:00Z" };
  expect(sortJobs([a, b]).map((j) => j.id)).toEqual([b.id, a.id]);
});
