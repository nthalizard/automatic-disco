/*  Printable alignment report. Hidden on screen; shown instead of the app when printing,
    so "Report" → Print → "Save as PDF" gives a clean light-background document. */

import { fmt, num, sgn } from "../core/format";
import type { Grade } from "../core/tolerance";
import { evaluate, footCallouts, gapReadout, unitLabels, type Evaluation } from "../state/evaluate";
import { readingsFor, type Job, type SignedReading, type Stage } from "../state/job";
import { PRINT } from "../theme";
import { Centerline } from "./Centerline";
import { gLabel } from "./grades";

const gClass: Record<Grade, string> = { excellent: "ok", acceptable: "warn", out: "bad" };

const dateTime = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

export function Report({ job, printedAt }: { job: Job; printedAt: Date }) {
  const { meta, inputs: inp } = job;
  const F = evaluate(inp, "found");
  const L = inp.asLeft ? evaluate(inp, "left") : null;
  const final = L ?? F;
  const u = unitLabels(inp.unit);
  const { dS, dL, uLen, uSm, uSl, smDec, eps, sgnS } = u;
  const cb = footCallouts(inp.unit, inp.hflip);
  const lim = F.lim;
  const hasTargets = [inp.tvoff, inp.tvgap, inp.thoff, inp.thgap].some((r) => num(r.mag) !== 0);
  const right = inp.hflip ? "left" : "right", left = inp.hflip ? "right" : "left";

  const len = (v: string) => (v.trim() ? `${v} ${uLen}` : "—");
  const rd = (r: SignedReading, pos: string, neg: string) =>
    num(r.mag) === 0 ? `0 ${uSm}` : `${fmt(num(r.mag), smDec)} ${uSm} · ${r.pos ? pos : neg}`;
  const limOff = `${fmt(dS(lim.excOff), smDec)} / ${fmt(dS(lim.accOff), smDec)} ${uSm}`;
  const limAng = `${fmt(lim.excAng, 2)} / ${fmt(lim.accAng, 2)} ${uSl}`;

  const found = readingsFor(inp, "found"), leftR = inp.asLeft;
  const rows = [
    { k: "Vertical parallelism", key: "voff", pos: "high", neg: "low", t: inp.tvoff, l: limOff,
      res: (e: Evaluation) => `${sgnS(e.R.rOffV)} ${uSm}`, g: (e: Evaluation) => e.gr.offV },
    { k: "Vertical angularity", key: "vgap", pos: "open bottom", neg: "open top", t: inp.tvgap, l: limAng,
      res: (e: Evaluation) => `${sgn(e.R.rSlopeV, 2)} ${uSl}`, g: (e: Evaluation) => e.gr.angV },
    { k: "Horizontal parallelism", key: "hoff", pos: "right", neg: "left", t: inp.thoff, l: limOff,
      res: (e: Evaluation) => `${sgnS(e.R.rOffH)} ${uSm}`, g: (e: Evaluation) => e.gr.offH },
    { k: "Horizontal angularity", key: "hgap", pos: "open left", neg: "open right", t: inp.thgap, l: limAng,
      res: (e: Evaluation) => `${sgn(e.R.rSlopeH, 2)} ${uSl}`, g: (e: Evaluation) => e.gr.angH },
  ] as const;
  const status = (g: ReturnType<(typeof rows)[number]["g"]>) => <td className={`rp-g ${gClass[g]}`}>{gLabel[g]}</td>;

  const vMove = (m: number) => { const v = dS(m); return Math.abs(v) < eps ? "no change" : `${v > 0 ? "ADD" : "REMOVE"} ${fmt(Math.abs(v), smDec)} ${uSm}`; };
  const hMove = (m: number) => { const v = dS(m); return Math.abs(v) < eps ? "no change" : `${fmt(Math.abs(v), smDec)} ${uSm} toward ${v > 0 ? right : left}`; };

  const drawings = (e: Evaluation, stage: Stage) => {
    const { R } = e;
    const gV = gapReadout(R.rGapV, "vertical", inp.unit), gH = gapReadout(R.rGapH, "horizontal", inp.unit);
    const common = { l1: R.l1, l2: R.l2, trueScale: false, gapUnit: uSm, movable: meta.movable, stationary: meta.stationary, palette: PRINT };
    const tag = stage === "left" ? "AS-LEFT" : "AS-FOUND";
    return (
      <div className={L ? "rp-drawings two" : "rp-drawings"}>
        <Centerline axis="vertical" title={`SIDE ELEVATION · ${tag}`} offset={R.rOffV} slope={R.rSlopeV} {...common}
          feet={[{ a: R.l1, m: R.feet.frontV, t: cb.v(R.feet.frontV) }, { a: R.l2, m: R.feet.backV, t: cb.v(R.feet.backV) }]}
          orient={`offset ${sgnS(R.rOffV)} ${uSm}`} offsetTxt={fmt(dS(R.rOffV), smDec)} gapVal={gV.val} open={gV.open} />
        <Centerline axis="horizontal" title={`PLAN VIEW · ${tag}`} offset={R.rOffH} slope={R.rSlopeH} {...common}
          feet={[{ a: R.l1, m: R.feet.frontH, t: cb.h(R.feet.frontH) }, { a: R.l2, m: R.feet.backH, t: cb.h(R.feet.backH) }]}
          orient={`up = ${right}`} offsetTxt={fmt(dS(R.rOffH), smDec)} gapVal={gH.val} open={gH.open} />
      </div>
    );
  };

  const limitsSource = !inp.tol ? "speed-based (general field guidance)"
    : inp.tolSource ? `preset “${inp.tolSource}”` : "entered by user";

  return (
    <div className="rp">
      <header className="rp-head">
        <div>
          <div className="rp-eyebrow">Shaft alignment report · gap &amp; offset method</div>
          <h1>{meta.name || "Untitled job"}</h1>
          <div className="rp-machines">{meta.movable} <small>(movable)</small> → {meta.stationary} <small>(stationary)</small></div>
        </div>
        <div className="rp-badges">
          <div className={`rp-overall ${gClass[final.overall]}`}><small>{L ? "AS-LEFT" : "AS-FOUND"}</small>{gLabel[final.overall]}</div>
          {L && <div className={`rp-was ${gClass[F.overall]}`}>as-found: {gLabel[F.overall]}</div>}
        </div>
      </header>

      <dl className="rp-meta">
        <div><dt>Site / area</dt><dd>{meta.site || "—"}</dd></div>
        <div><dt>Technician</dt><dd>{meta.technician || "—"}</dd></div>
        <div><dt>Readings last edited</dt><dd>{dateTime(job.updatedAt)}</dd></div>
        <div><dt>Printed</dt><dd>{dateTime(printedAt.toISOString())}</dd></div>
        <div><dt>Speed</dt><dd>{fmt(num(inp.rpm), 0)} rpm</dd></div>
        <div><dt>Tolerance limits</dt><dd>{limitsSource}</dd></div>
      </dl>

      <h2>Geometry</h2>
      <table className="rp-t">
        <tbody>
          <tr><th>Coupling diameter</th><td>{len(inp.D)}</td><th>Coupling → front foot</th><td>{len(inp.L1)}</td></tr>
          <tr><th>Front → back foot</th><td>{len(inp.Ls)}</td><th>Coupling → back foot</th><td>{fmt(dL(F.R.l2), u.met ? 1 : 2)} {uLen}</td></tr>
          <tr><th>DBSE (shaft ends)</th><td>{len(inp.dbse)}</td><th>Horizontal convention</th><td>{inp.hflip ? "reversed (viewpoint flipped)" : "standard"}</td></tr>
        </tbody>
      </table>

      <h2>Readings &amp; tolerance</h2>
      <table className="rp-t rp-grid">
        <thead>
          {L ? (
            <tr><th /><th>As-found</th><th>Status</th><th>As-left</th><th>Residual</th><th>Limit exc / acc</th><th>Status</th></tr>
          ) : (
            <tr><th /><th>Measured</th><th>Residual</th><th>Limit exc / acc</th><th>Status</th></tr>
          )}
        </thead>
        <tbody>
          {rows.map((r) => L && leftR ? (
            <tr key={r.k}>
              <th>{r.k}</th><td>{rd(found[r.key], r.pos, r.neg)}</td>{status(r.g(F))}
              <td>{rd(leftR[r.key], r.pos, r.neg)}</td><td className="num">{r.res(L)}</td><td>{r.l}</td>{status(r.g(L))}
            </tr>
          ) : (
            <tr key={r.k}>
              <th>{r.k}</th><td>{rd(found[r.key], r.pos, r.neg)}</td><td className="num">{r.res(F)}</td><td>{r.l}</td>{status(r.g(F))}
            </tr>
          ))}
        </tbody>
      </table>
      {hasTargets && (
        <p className="rp-small"><b>Targets (cold offsets for thermal growth):</b>{" "}
          {rows.map((r) => `${r.k.toLowerCase()} ${rd(r.t, r.pos, r.neg)}`).join(" · ")}. Residual = measured − target.
        </p>
      )}
      <p className="rp-small">
        Angularity readings are coupling gap per coupling diameter; residual angularity is slope (gap ÷ diameter).
        {hasTargets ? "" : " No targets set: aligning to zero."}
      </p>

      <h2>Foot corrections — {meta.movable}</h2>
      <table className="rp-t rp-grid">
        <thead>
          <tr><th>Foot</th><th>From coupling</th>
            <th>{L ? "As-found vertical" : "Vertical (shims)"}</th><th>{L ? "As-found horizontal" : "Horizontal (move)"}</th>
            {L && <><th>Remaining vertical</th><th>Remaining horizontal</th></>}
          </tr>
        </thead>
        <tbody>
          {(["front", "back"] as const).map((f) => {
            const fv = f === "front" ? "frontV" : "backV", fh = f === "front" ? "frontH" : "backH";
            return (
              <tr key={f}>
                <th>{f === "front" ? "Front" : "Back"}</th><td>{fmt(dL(f === "front" ? F.R.l1 : F.R.l2), u.met ? 0 : 1)} {uLen}</td>
                <td>{vMove(F.R.feet[fv])}</td><td>{hMove(F.R.feet[fh])}</td>
                {L && <><td>{vMove(L.R.feet[fv])}</td><td>{hMove(L.R.feet[fh])}</td></>}
              </tr>
            );
          })}
        </tbody>
      </table>
      {L && <p className="rp-small">As-found columns are the moves calculated before correction; remaining columns are what the as-left readings still call for.</p>}

      {drawings(F, "found")}
      {L && drawings(L, "left")}
      <p className="rp-small">Drawings exaggerated vertically for readability; values in the tables are true.</p>

      {meta.notes.trim() && (<><h2>Notes</h2><p className="rp-notes">{meta.notes}</p></>)}

      <div className="rp-sign">
        <div><span />Technician signature</div>
        <div><span />Date</div>
        <div><span />Reviewed by</div>
      </div>

      <footer className="rp-foot">
        Corrections assume a rigid movable machine and corrected soft foot. Verify sign conventions against your laser tool before shimming.
      </footer>
    </div>
  );
}
