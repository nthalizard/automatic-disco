import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { createJob, exampleInputs, exampleMeta } from "./job";
import { memoryStore, openJobStore, sortJobs } from "./storage";

describe.each([
  ["indexeddb", openJobStore],
  ["memory", async () => memoryStore()],
])("%s store", (name, open) => {
  it("saves, lists, updates and removes jobs", async () => {
    const store = await open();
    expect(store.persistent).toBe(name === "indexeddb");
    for (const j of await store.list()) await store.remove(j.id);

    const a = createJob(exampleMeta(), exampleInputs());
    await store.put(a);
    expect(await store.list()).toEqual([a]);

    const edited = { ...a, meta: { ...a.meta, name: "Edited" } };
    await store.put(edited);
    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0].meta.name).toBe("Edited");

    await store.remove(a.id);
    expect(await store.list()).toEqual([]);
  });
});

it("sortJobs puts the most recently edited first", () => {
  const a = { ...createJob(), updatedAt: "2026-01-01T00:00:00Z" };
  const b = { ...createJob(), updatedAt: "2026-03-01T00:00:00Z" };
  expect(sortJobs([a, b]).map((j) => j.id)).toEqual([b.id, a.id]);
});
