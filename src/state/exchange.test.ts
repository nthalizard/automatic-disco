import { describe, expect, it } from "vitest";
import { exportFileName, parseJobFile, planImport, serializeJobs, slug } from "./exchange";
import { createJob, exampleInputs, exampleMeta, type Job } from "./job";

const at = (iso: string) => new Date(iso);
const job = (updated: string, name = "Pump 3"): Job => {
  const j = createJob({ ...exampleMeta(), name }, exampleInputs(), at(updated));
  return j;
};

describe("serialize / parse", () => {
  it("round-trips jobs exactly", () => {
    const jobs = [job("2026-01-01T00:00:00Z"), job("2026-01-02T00:00:00Z", "Fan 2")];
    const { jobs: back, skipped } = parseJobFile(serializeJobs(jobs));
    expect(back).toEqual(jobs);
    expect(skipped).toEqual([]);
  });

  it("fills missing fields with defaults and drops junk", () => {
    const text = JSON.stringify({
      format: "shaft-alignment-jobs", version: 1,
      jobs: [{ id: "a", meta: { name: "Old", extra: 1 }, inputs: { unit: "met", D: 150, voff: { mag: "1" }, junk: true } }],
    });
    const [j] = parseJobFile(text, at("2026-03-01T00:00:00Z")).jobs;
    expect(j.meta.name).toBe("Old");
    expect(j.meta.movable).toBe("Movable");
    expect(j.inputs.unit).toBe("met");
    expect(j.inputs.D).toBe("150");
    expect(j.inputs.voff).toEqual({ mag: "1", pos: true });
    expect(j.inputs.hgap).toEqual({ mag: "0", pos: true });
    expect("junk" in j.inputs).toBe(false);
    expect(j.createdAt).toBe("2026-03-01T00:00:00.000Z");
  });

  it("skips unreadable entries but keeps the rest", () => {
    const text = JSON.stringify({ format: "shaft-alignment-jobs", version: 1, jobs: [{ id: "x" }, job("2026-01-01T00:00:00Z")] });
    const r = parseJobFile(text);
    expect(r.jobs).toHaveLength(1);
    expect(r.skipped).toHaveLength(1);
  });

  it("accepts a single bare job", () => {
    expect(parseJobFile(JSON.stringify(job("2026-01-01T00:00:00Z"))).jobs).toHaveLength(1);
  });

  it("rejects non-job files and newer versions", () => {
    expect(() => parseJobFile("not json")).toThrow(/JSON/);
    expect(() => parseJobFile('{"hello":1}')).toThrow(/doesn't contain/);
    expect(() => parseJobFile('{"format":"shaft-alignment-jobs","version":99,"jobs":[]}')).toThrow(/newer/);
  });
});

describe("planImport", () => {
  it("adds new, replaces only if newer, keeps the rest", () => {
    const a = job("2026-01-01T00:00:00Z"), b = job("2026-01-05T00:00:00Z");
    const aNewer = { ...a, updatedAt: "2026-02-01T00:00:00.000Z" };
    const bOlder = { ...b, updatedAt: "2026-01-01T00:00:00.000Z" };
    const c = job("2026-01-03T00:00:00Z");
    const plan = planImport([a, b], [aNewer, bOlder, c]);
    expect(plan).toMatchObject({ added: 1, updated: 1, unchanged: 1 });
    expect(plan.toSave.map((j) => j.id)).toEqual([a.id, c.id]);
  });

  it("the same file twice changes nothing the second time", () => {
    const a = job("2026-01-01T00:00:00Z");
    expect(planImport([a], [a])).toMatchObject({ added: 0, updated: 0, unchanged: 1, toSave: [] });
  });
});

describe("file names", () => {
  it("slugs names", () => {
    expect(slug("Example — Compressor 1 → Gearbox 2")).toBe("example-compressor-1-gearbox-2");
    expect(slug("   ")).toBe("job");
  });
  it("names single and multi exports", () => {
    const now = at("2026-09-26T12:00:00Z");
    expect(exportFileName([job("2026-01-01T00:00:00Z", "P-101 A")], now)).toBe("alignment-p-101-a-2026-09-26.json");
    expect(exportFileName([], now)).toBe("alignment-jobs-2026-09-26.json");
  });
});
