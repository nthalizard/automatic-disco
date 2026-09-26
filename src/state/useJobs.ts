import { useCallback, useEffect, useRef, useState } from "react";
import { planImport, readJob, type MergePlan } from "./exchange";
import { blankInputs, createJob, duplicateJob, exampleInputs, exampleMeta, type Job } from "./job";
import { sortPresets, type TolPreset } from "./presets";
import { getLastJobId, openJobStore, setLastJobId, sortJobs, type JobStore } from "./storage";

export type SaveState = "saved" | "saving" | "error";

const SAVE_DELAY_MS = 400;

// Shared across mounts so a double-mounted effect (React StrictMode) can't seed the example twice.
let initial: Promise<{ s: JobStore; list: Job[]; presets: TolPreset[] }> | null = null;
function loadOnce() {
  initial ??= (async () => {
    const s = await openJobStore();
    let list: Job[] = [];
    try {
      // jobs saved by an older version get any new fields filled in
      list = (await s.list()).map((j) => readJob(j)).filter((j): j is Job => j !== null);
    } catch { /* treat as empty */ }
    if (list.length === 0) {
      const ex = createJob(exampleMeta(), exampleInputs());
      try { await s.put(ex); } catch { /* shown via saveState on next edit */ }
      list = [ex];
    }
    let presets: TolPreset[] = [];
    try { presets = await s.listPresets(); } catch { /* none */ }
    return { s, list, presets };
  })();
  return initial;
}

/** Jobs list + the open job, auto-saved to browser storage shortly after each edit. */
export function useJobs() {
  const [store, setStore] = useState<JobStore | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [presets, setPresets] = useState<TolPreset[]>([]);
  const presetsRef = useRef<TolPreset[]>([]);
  const commitPresets = (next: TolPreset[]) => { presetsRef.current = sortPresets(next); setPresets(presetsRef.current); };

  // mirrors of state for use inside async callbacks
  const jobsRef = useRef<Job[]>([]);
  const storeRef = useRef<JobStore | null>(null);
  const pending = useRef(new Map<string, Job>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitJobs = (next: Job[]) => { jobsRef.current = next; setJobs(next); };

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const s = storeRef.current;
    if (!s || pending.current.size === 0) return;
    const batch = [...pending.current.values()];
    pending.current.clear();
    try {
      for (const j of batch) await s.put(j);
      if (pending.current.size === 0) setSaveState("saved");
    } catch {
      for (const j of batch) if (!pending.current.has(j.id)) pending.current.set(j.id, j);
      setSaveState("error");
    }
  }, []);

  const queueSave = useCallback((job: Job) => {
    pending.current.set(job.id, job);
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }, [flush]);

  // open storage once; seed the example job on first run
  useEffect(() => {
    let alive = true;
    loadOnce().then(({ s, list, presets }) => {
      if (!alive) return;
      commitPresets(presets);
      storeRef.current = s;
      setStore(s);
      const sorted = sortJobs(list);
      commitJobs(sorted);
      const last = getLastJobId();
      setCurrentId(sorted.some((j) => j.id === last) ? last : sorted[0].id);
    });
    return () => { alive = false; };
  }, []);

  // don't lose the last keystrokes when the tab is hidden or closed
  useEffect(() => {
    const onHide = () => { void flush(); };
    const onVis = () => { if (document.visibilityState === "hidden") void flush(); };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVis);
    return () => { window.removeEventListener("pagehide", onHide); document.removeEventListener("visibilitychange", onVis); };
  }, [flush]);

  useEffect(() => { if (currentId) setLastJobId(currentId); }, [currentId]);

  const job = jobs.find((j) => j.id === currentId) ?? null;

  /** Edit the open job. */
  const update = useCallback((fn: (j: Job) => Job) => {
    const cur = jobsRef.current.find((j) => j.id === currentId);
    if (!cur) return;
    const next = { ...fn(cur), updatedAt: new Date().toISOString() };
    commitJobs(jobsRef.current.map((j) => (j.id === next.id ? next : j)));
    queueSave(next);
  }, [currentId, queueSave]);

  // Switch right away (pending saves are per job, so nothing is lost); waiting for the write
  // first would let edits made in that gap land on the previous job.
  const add = useCallback(async (j: Job) => {
    commitJobs([j, ...jobsRef.current]);
    setCurrentId(j.id);
    queueSave(j);
  }, [queueSave]);

  const open = useCallback(async (id: string) => { setCurrentId(id); void flush(); }, [flush]);

  const newJob = useCallback(() => {
    const unit = jobsRef.current.find((j) => j.id === currentId)?.inputs.unit ?? "imp";
    return add(createJob(undefined, { ...blankInputs(), unit }));
  }, [add, currentId]);

  const duplicate = useCallback(() => {
    const cur = jobsRef.current.find((j) => j.id === currentId);
    return cur ? add(duplicateJob(cur)) : Promise.resolve();
  }, [add, currentId]);

  const remove = useCallback(async (id: string) => {
    await flush();
    pending.current.delete(id);
    await storeRef.current?.remove(id);
    const rest = jobsRef.current.filter((j) => j.id !== id);
    if (rest.length === 0) {
      const fresh = createJob();
      commitJobs([fresh]);
      setCurrentId(fresh.id);
      queueSave(fresh);
      return;
    }
    commitJobs(rest);
    if (id === currentId) setCurrentId(sortJobs(rest)[0].id);
  }, [currentId, flush, queueSave]);

  const savePreset = useCallback(async (p: TolPreset) => {
    await storeRef.current?.putPreset(p);
    commitPresets([...presetsRef.current.filter((x) => x.id !== p.id), p]);
  }, []);

  const removePreset = useCallback(async (id: string) => {
    await storeRef.current?.removePreset(id);
    commitPresets(presetsRef.current.filter((x) => x.id !== id));
  }, []);

  const importJobs = useCallback(async (incoming: Job[], incomingPresets: TolPreset[] = []): Promise<{ jobs: MergePlan; presets: MergePlan<TolPreset> }> => {
    await flush();
    const pPlan = planImport(presetsRef.current, incomingPresets);
    for (const p of pPlan.toSave) await storeRef.current?.putPreset(p);
    const pById = new Map(presetsRef.current.map((p) => [p.id, p]));
    for (const p of pPlan.toSave) pById.set(p.id, p);
    commitPresets([...pById.values()]);

    const plan = planImport(jobsRef.current, incoming);
    for (const j of plan.toSave) await storeRef.current?.put(j);
    const byId = new Map(jobsRef.current.map((j) => [j.id, j]));
    for (const j of plan.toSave) byId.set(j.id, j);
    commitJobs(sortJobs([...byId.values()]));
    if (plan.toSave.length === 1) setCurrentId(plan.toSave[0].id);
    return { jobs: plan, presets: pPlan };
  }, [flush]);

  return {
    ready: store !== null,
    persistent: store?.persistent ?? true,
    jobs, job, saveState, presets,
    update, open, newJob, duplicate, remove, importJobs, savePreset, removePreset,
  };
}
