import { useCallback, useRef, useState } from "react";
import { fmt, num, sgn } from "./core/format";
import type { TolKey } from "./core/tolerance";
import type { Unit } from "./core/units";
import { Centerline } from "./components/Centerline";
import { FootRow } from "./components/FootRow";
import { gColor, gLabel } from "./components/grades";
import { Field, Panel, Reading, TolCell } from "./components/inputs";
import { JobBar } from "./components/JobBar";
import { JobDetails } from "./components/JobDetails";
import { JobsDialog } from "./components/JobsDialog";
import { Report } from "./components/Report";
import { TolBar } from "./components/TolBar";
import { evaluate, footCallouts, gapReadout, unitLabels } from "./state/evaluate";
import { downloadText, exportFileName, parseJobFile, serializeJobs, slug } from "./state/exchange";
import { convertInputs, type Job, type JobInputs, type JobMeta } from "./state/job";
import { useJobs } from "./state/useJobs";
import { css } from "./styles";
import { C } from "./theme";

/*  Movable machine (MTBM) -> stationary machine.
    Inputs are held as typed text in the display unit; the core math runs in imperial. */

export default function App() {
  const J = useJobs();
  const [showJobs, setShowJobs] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [trueScale, setTrueScale] = useState(false);
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const [printedAt, setPrintedAt] = useState(() => new Date());
  const fileInput = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((text: string, bad = false) => {
    setNotice({ text, bad });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 7000);
  }, []);

  if (!J.ready || !J.job) return <div className="sa-root"><style>{css}</style><div className="sa-loading">Loading jobs…</div></div>;

  const job = J.job;
  const inp = job.inputs, meta = job.meta;
  const set = (patch: Partial<JobInputs>) => J.update((j) => ({ ...j, inputs: { ...j.inputs, ...patch } }));
  const setMeta = (patch: Partial<JobMeta>) => J.update((j) => ({ ...j, meta: { ...j.meta, ...patch } }));
  const switchUnit = (target: Unit) => J.update((j) => ({ ...j, inputs: convertInputs(j.inputs, target) }));

  const { R, auto, lim, gr, overall } = evaluate(inp);
  const { met, uLen, uSm, uSl, smDec, dS, dL, sgnS } = unitLabels(inp.unit);
  const { tol, hflip } = inp;
  const tolCell = (key: TolKey, autoVal: number, isAng: boolean) => tol?.[key] != null ? tol[key] : (isAng ? autoVal : dS(autoVal));
  const setTol = (key: TolKey, v: string) => set({ tol: { ...(tol || {}), [key]: v } });
  const gV = gapReadout(R.rGapV, "vertical", inp.unit), gH = gapReadout(R.rGapH, "horizontal", inp.unit);
  const cb = footCallouts(inp.unit, hflip);

  /* ---- job actions ---- */
  const exportJobs = (jobs: Job[]) => {
    downloadText(serializeJobs(jobs), exportFileName(jobs));
    say(`Downloaded ${jobs.length === 1 ? "this job" : `${jobs.length} jobs`} — check your Downloads folder.`);
  };
  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { jobs, skipped } = parseJobFile(await file.text());
      const p = await J.importJobs(jobs);
      const parts = [p.added && `${p.added} added`, p.updated && `${p.updated} updated`, p.unchanged && `${p.unchanged} already up to date`,
        skipped.length && `${skipped.length} unreadable`].filter(Boolean);
      say(`Imported ${file.name}: ${parts.join(", ") || "no jobs found"}.`, skipped.length > 0 && p.toSave.length === 0);
      setShowJobs(false);
    } catch (e) {
      say(`Couldn't import ${file.name}: ${(e as Error).message}`, true);
    }
  };
  const onDelete = (j: Job) => {
    if (window.confirm(`Delete "${j.meta.name || "Untitled job"}"? This can't be undone unless you exported it.`)) void J.remove(j.id);
  };
  const onReport = () => {
    setPrintedAt(new Date());
    // the page title becomes the default PDF file name
    const prev = document.title;
    document.title = `alignment-${slug(meta.name)}-${new Date().toISOString().slice(0, 10)}`;
    const restore = () => { document.title = prev; window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore);
    setTimeout(() => window.print(), 50);
  };
  const onNew = async () => { await J.newJob(); setDetailsOpen(true); };
  const onDuplicate = async () => { await J.duplicate(); setDetailsOpen(true); say("Copied — rename it (e.g. \"as-left\") and enter the new readings."); };

  return (
    <>
      <div className="sa-root sa-screen">
        <style>{css}</style>
        <header className="sa-head">
          <JobBar name={meta.name} saveState={J.saveState} persistent={J.persistent}
            onJobs={() => setShowJobs(true)} onNew={onNew} onDuplicate={onDuplicate}
            onExport={() => exportJobs([job])} onImport={() => fileInput.current?.click()} onReport={onReport} />
          {notice && <div className={notice.bad ? "sa-notice bad" : "sa-notice"} role="status" onClick={() => setNotice(null)}>{notice.text}</div>}
          <div className="sa-head-row">
            <div>
              <div className="sa-eyebrow">Rotating Equipment · Precision Alignment</div>
              <h1 className="sa-title">Shaft Alignment<span className="sa-title-sub"> / gap &amp; offset method</span></h1>
            </div>
            <div className="sa-unit" role="group" aria-label="units">
              <button className={!met ? "sa-unit-b on" : "sa-unit-b"} onClick={() => switchUnit("imp")}>THOU</button>
              <button className={met ? "sa-unit-b on" : "sa-unit-b"} onClick={() => switchUnit("met")}>MM</button>
            </div>
          </div>
          <div className="sa-beam" aria-hidden="true">
            <span className="sa-node sa-node-mov">{meta.movable.toUpperCase()}&nbsp;·&nbsp;MOVABLE</span>
            <span className="sa-line"><i /></span>
            <span className="sa-node">{meta.stationary.toUpperCase()}&nbsp;·&nbsp;STATIONARY</span>
          </div>
        </header>

        <div className="sa-grid">
          {/* INPUTS */}
          <section className="sa-col">
            <JobDetails meta={meta} set={setMeta} open={detailsOpen} setOpen={setDetailsOpen} />

            <Panel title="Machine geometry" hint="reference plane = coupling center">
              <div className="sa-fields">
                <Field label="Coupling dia." unit={uLen} value={inp.D} onChange={(v) => set({ D: v })} />
                <Field label="Coupling → front foot" unit={uLen} value={inp.L1} onChange={(v) => set({ L1: v })} />
                <Field label="Front → back foot" unit={uLen} value={inp.Ls} onChange={(v) => set({ Ls: v })} />
                <Field label="DBSE (shaft ends)" unit={uLen} value={inp.dbse} onChange={(v) => set({ dbse: v })} sub="reference only" />
                <Field label="Speed" unit="rpm" value={inp.rpm} onChange={(v) => set({ rpm: v, tol: null })} />
                <div className="sa-derived">back foot @ <b>{fmt(dL(R.l2), met ? 1 : 0)} {uLen}</b> from coupling</div>
              </div>
            </Panel>

            <Panel title="Measured readings" hint="as-found · parallelism = offset, angularity = gap">
              <Reading label="Vertical parallelism" r={inp.voff} set={(r) => set({ voff: r })} unit={uSm} pos="Movable HIGH" neg="Movable LOW" />
              <Reading label="Vertical angularity" r={inp.vgap} set={(r) => set({ vgap: r })} unit={uSm + " / dia"} pos="Open at BOTTOM" neg="Open at TOP" />
              <div className="sa-sep" />
              <Reading label="Horizontal parallelism" r={inp.hoff} set={(r) => set({ hoff: r })} unit={uSm} pos="Movable RIGHT" neg="Movable LEFT" />
              <Reading label="Horizontal angularity" r={inp.hgap} set={(r) => set({ hgap: r })} unit={uSm + " / dia"} pos="Open at LEFT" neg="Open at RIGHT" />
              <label className="sa-check">
                <input type="checkbox" checked={hflip} onChange={(e) => set({ hflip: e.target.checked })} />
                <span>Reverse horizontal convention (viewpoint flipped)</span>
              </label>
            </Panel>

            <Panel title="Targets" hint={inp.showTargets ? "cold offsets for thermal growth" : "aligning to zero"}
              right={<button className="sa-toggle-btn" onClick={() => set({ showTargets: !inp.showTargets })}>{inp.showTargets ? "Hide" : "Set targets"}</button>}>
              {inp.showTargets ? (
                <>
                  <Reading label="Target V parallelism" r={inp.tvoff} set={(r) => set({ tvoff: r })} unit={uSm} pos="High" neg="Low" />
                  <Reading label="Target V angularity" r={inp.tvgap} set={(r) => set({ tvgap: r })} unit={uSm + " / dia"} pos="Open bottom" neg="Open top" />
                  <div className="sa-sep" />
                  <Reading label="Target H parallelism" r={inp.thoff} set={(r) => set({ thoff: r })} unit={uSm} pos="Right" neg="Left" />
                  <Reading label="Target H angularity" r={inp.thgap} set={(r) => set({ thgap: r })} unit={uSm + " / dia"} pos="Open left" neg="Open right" />
                </>
              ) : (
                <div className="sa-emptyhint">No targets set — corrections drive the shafts to zero (cold = hot).
                  Set cold targets to pre-compensate measured thermal growth.</div>
              )}
            </Panel>

            <Panel title="Tolerance limits" hint={`speed-based · ${fmt(num(inp.rpm), 0)} rpm`}
              right={tol ? <button className="sa-toggle-btn" onClick={() => set({ tol: null })}>Reset to speed</button> : null}>
              <div className="sa-tolgrid">
                <div className="sa-tolhead" />
                <div className="sa-tolhead" style={{ color: C.ok }}>EXCELLENT</div>
                <div className="sa-tolhead" style={{ color: C.warn }}>ACCEPTABLE</div>
                <div className="sa-tollabel">Offset ({uSm})</div>
                <TolCell v={tolCell("eo", auto.eo, false)} onChange={(v) => setTol("eo", v)} />
                <TolCell v={tolCell("ao", auto.ao, false)} onChange={(v) => setTol("ao", v)} />
                <div className="sa-tollabel">Angularity ({uSl})</div>
                <TolCell v={tolCell("ea", auto.ea, true)} onChange={(v) => setTol("ea", v)} />
                <TolCell v={tolCell("aa", auto.aa, true)} onChange={(v) => setTol("aa", v)} />
              </div>
              <div className="sa-emptyhint">General field guidance for pumps/motors. Override with your OEM / site spec.</div>
            </Panel>
          </section>

          {/* RESULTS */}
          <section className="sa-col">
            <div className="sa-status" style={{ borderColor: gColor[overall], boxShadow: `0 0 0 1px ${gColor[overall]}22, 0 0 24px ${gColor[overall]}18` }}>
              <div className="sa-status-dot" style={{ background: gColor[overall], boxShadow: `0 0 10px ${gColor[overall]}` }} />
              <div>
                <div className="sa-status-k">Residual vs target</div>
                <div className="sa-status-v" style={{ color: gColor[overall] }}>{gLabel[overall]}</div>
              </div>
            </div>

            <Panel title="Alignment view" hint={trueScale ? "movable vs stationary datum · 1:1 true scale" : "movable vs stationary datum · exaggerated"}
              right={<div className="sa-scale"><button className={!trueScale ? "sa-scale-b on" : "sa-scale-b"} onClick={() => setTrueScale(false)}>EXAG</button><button className={trueScale ? "sa-scale-b on" : "sa-scale-b"} onClick={() => setTrueScale(true)}>1:1</button></div>}>
              <Centerline axis="vertical" title="SIDE ELEVATION" offset={R.rOffV} slope={R.rSlopeV} movable={meta.movable} stationary={meta.stationary}
                l1={R.l1} l2={R.l2} feet={[{ a: R.l1, m: R.feet.frontV, t: cb.v(R.feet.frontV) }, { a: R.l2, m: R.feet.backV, t: cb.v(R.feet.backV) }]}
                orient={`offset ${sgnS(R.rOffV)} ${uSm}`} offsetTxt={fmt(dS(R.rOffV), smDec)} trueScale={trueScale} gapVal={gV.val} gapUnit={uSm} open={gV.open} />
              <div className="sa-view-sep" />
              <Centerline axis="horizontal" title="PLAN VIEW" offset={R.rOffH} slope={R.rSlopeH} movable={meta.movable} stationary={meta.stationary}
                l1={R.l1} l2={R.l2} feet={[{ a: R.l1, m: R.feet.frontH, t: cb.h(R.feet.frontH) }, { a: R.l2, m: R.feet.backH, t: cb.h(R.feet.backH) }]}
                orient={`up = ${hflip ? "left" : "right"}`} offsetTxt={fmt(dS(R.rOffH), smDec)} trueScale={trueScale} gapVal={gH.val} gapUnit={uSm} open={gH.open} />
              <div className="sa-view-note">Scale toggle top-right: <b>EXAG</b> magnifies for readability; <b>1:1</b> shows true geometry (small misalignment looks nearly flat — that’s real). True numbers are in the callouts &amp; foot table.</div>
            </Panel>

            <Panel title="Foot corrections" hint={`${meta.movable} (movable) · to reach target`}>
              <div className="sa-foot">
                <div className="sa-foot-h"><span>Foot</span><span>Vertical (shims)</span><span>Horizontal (move)</span></div>
                <FootRow name="Front" dist={dL(R.l1)} du={uLen} um={uSm} eps={unitLabels(inp.unit).eps} v={dS(R.feet.frontV)} h={dS(R.feet.frontH)} />
                <FootRow name="Back" dist={dL(R.l2)} du={uLen} um={uSm} eps={unitLabels(inp.unit).eps} v={dS(R.feet.backV)} h={dS(R.feet.backH)} />
              </div>
              <div className="sa-foot-legend">
                <span><b style={{ color: C.ok }}>+V</b> add shims (raise)&nbsp;·&nbsp;<b>−V</b> remove (lower)</span>
                <span><b style={{ color: C.amber }}>+H</b> toward {hflip ? "left" : "right"}&nbsp;·&nbsp;<b>−H</b> toward {hflip ? "right" : "left"}</span>
              </div>
            </Panel>

            <Panel title="Tolerance" hint={`residual vs limits · ${fmt(num(inp.rpm), 0)} rpm`}>
              <TolBar label="Offset V" v={R.rOffV} exc={lim.excOff} acc={lim.accOff} status={gr.offV} txt={sgnS(R.rOffV)} lim={fmt(dS(lim.accOff), smDec)} unit={uSm} />
              <TolBar label="Angle V" v={R.rSlopeV} exc={lim.excAng} acc={lim.accAng} status={gr.angV} txt={sgn(R.rSlopeV, 2)} lim={fmt(lim.accAng, 2)} unit={uSl} />
              <TolBar label="Offset H" v={R.rOffH} exc={lim.excOff} acc={lim.accOff} status={gr.offH} txt={sgnS(R.rOffH)} lim={fmt(dS(lim.accOff), smDec)} unit={uSm} />
              <TolBar label="Angle H" v={R.rSlopeH} exc={lim.excAng} acc={lim.accAng} status={gr.angH} txt={sgn(R.rSlopeH, 2)} lim={fmt(lim.accAng, 2)} unit={uSl} />
              <div className="sa-bar-cap"><b style={{ color: C.ok }}>green</b> ≤ excellent · <b style={{ color: C.warn }}>amber</b> ≤ acceptable · <b style={{ color: C.bad }}>red</b> beyond · marker = residual (signed), tick = 0 / at-target</div>
            </Panel>
          </section>
        </div>

        <footer className="sa-foot-note">
          Slope = gap ÷ coupling dia. Corrections assume a rigid movable machine and corrected soft foot.
          Verify sign conventions against your laser tool before shimming.
        </footer>

        <input ref={fileInput} type="file" accept=".json,application/json" hidden
          onChange={(e) => { void onImportFile(e.target.files?.[0]); e.target.value = ""; }} />
        {showJobs && (
          <JobsDialog jobs={J.jobs} currentId={job.id}
            onOpen={(id) => { void J.open(id); setShowJobs(false); }} onDelete={onDelete}
            onExportAll={() => exportJobs(J.jobs)} onImport={() => fileInput.current?.click()} onClose={() => setShowJobs(false)} />
        )}
      </div>
      <Report job={job} printedAt={printedAt} />
    </>
  );
}
