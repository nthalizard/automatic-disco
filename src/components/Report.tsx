/*  Printable alignment report. Hidden on screen; shown instead of the app when printing,
    so "Report" → Print → "Save as PDF" gives a clean light-background document. */

import { fmt, num, sgn } from "../core/format";
import type { Grade } from "../core/tolerance";
import { evaluate, footCallouts, gapReadout, unitLabels } from "../state/evaluate";
import type { Job, SignedReading } from "../state/job";
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
  const { R, lim, gr, overall } = evaluate(inp);
  const u = unitLabels(inp.unit);
  const { dS, dL, uLen, uSm, uSl, smDec, eps, sgnS } = u;
  const cb = footCallouts(inp.unit, inp.hflip);
  const gV = gapReadout(R.rGapV, "vertical", inp.unit), gH = gapReadout(R.rGapH, "horizontal", inp.unit);
  const hasTargets = [inp.tvoff, inp.tvgap, inp.thoff, inp.thgap].some((r) => num(r.mag) !== 0);
  const right = inp.hflip ? "left" : "right", left = inp.hflip ? "right" : "left";

  const len = (v: string) => (v.trim() ? `${v} ${uLen}` : "—");
  const rd = (r: SignedReading, pos: string, neg: string) =>
    num(r.mag) === 0 ? `0 ${uSm}` : `${fmt(num(r.mag), smDec)} ${uSm} · ${r.pos ? pos : neg}`;

  const rows = [
    { k: "Vertical parallelism", m: rd(inp.voff, "high", "low"), t: rd(inp.tvoff, "high", "low"),
      res: `${sgnS(R.rOffV)} ${uSm}`, l: `${fmt(dS(lim.excOff), smDec)} / ${fmt(dS(lim.accOff), smDec)} ${uSm}`, g: gr.offV },
    { k: "Vertical angularity", m: rd(inp.vgap, "open bottom", "open top"), t: rd(inp.tvgap, "open bottom", "open top"),
      res: `${sgn(R.rSlopeV, 2)} ${uSl}`, l: `${fmt(lim.excAng, 2)} / ${fmt(lim.accAng, 2)} ${uSl}`, g: gr.angV },
    { k: "Horizontal parallelism", m: rd(inp.hoff, "right", "left"), t: rd(inp.thoff, "right", "left"),
      res: `${sgnS(R.rOffH)} ${uSm}`, l: `${fmt(dS(lim.excOff), smDec)} / ${fmt(dS(lim.accOff), smDec)} ${uSm}`, g: gr.offH },
    { k: "Horizontal angularity", m: rd(inp.hgap, "open left", "open right"), t: rd(inp.thgap, "open left", "open right"),
      res: `${sgn(R.rSlopeH, 2)} ${uSl}`, l: `${fmt(lim.excAng, 2)} / ${fmt(lim.accAng, 2)} ${uSl}`, g: gr.angH },
  ];

  const vMove = (m: number) => { const v = dS(m); return Math.abs(v) < eps ? "no change" : `${v > 0 ? "ADD" : "REMOVE"} ${fmt(Math.abs(v), smDec)} ${uSm}`; };
  const hMove = (m: number) => { const v = dS(m); return Math.abs(v) < eps ? "no change" : `${fmt(Math.abs(v), smDec)} ${uSm} toward ${v > 0 ? right : left}`; };

  const drawing = { l1: R.l1, l2: R.l2, trueScale: false, gapUnit: uSm, movable: meta.movable, stationary: meta.stationary, palette: PRINT };

  return (
    <div className="rp">
      <header className="rp-head">
        <div>
          <div className="rp-eyebrow">Shaft alignment report · gap &amp; offset method</div>
          <h1>{meta.name || "Untitled job"}</h1>
          <div className="rp-machines">{meta.movable} <small>(movable)</small> → {meta.stationary} <small>(stationary)</small></div>
        </div>
        <div className={`rp-overall ${gClass[overall]}`}>{gLabel[overall]}</div>
      </header>

      <dl className="rp-meta">
        <div><dt>Site / area</dt><dd>{meta.site || "—"}</dd></div>
        <div><dt>Technician</dt><dd>{meta.technician || "—"}</dd></div>
        <div><dt>Readings last edited</dt><dd>{dateTime(job.updatedAt)}</dd></div>
        <div><dt>Printed</dt><dd>{dateTime(printedAt.toISOString())}</dd></div>
        <div><dt>Speed</dt><dd>{fmt(num(inp.rpm), 0)} rpm</dd></div>
        <div><dt>Units</dt><dd>{u.met ? "mm, mm/m" : "thou, in, thou/in"}</dd></div>
      </dl>

      <h2>Geometry</h2>
      <table className="rp-t">
        <tbody>
          <tr><th>Coupling diameter</th><td>{len(inp.D)}</td><th>Coupling → front foot</th><td>{len(inp.L1)}</td></tr>
          <tr><th>Front → back foot</th><td>{len(inp.Ls)}</td><th>Coupling → back foot</th><td>{fmt(dL(R.l2), u.met ? 1 : 2)} {uLen}</td></tr>
          <tr><th>DBSE (shaft ends)</th><td>{len(inp.dbse)}</td><th>Horizontal convention</th><td>{inp.hflip ? "reversed (viewpoint flipped)" : "standard"}</td></tr>
        </tbody>
      </table>

      <h2>Readings &amp; tolerance</h2>
      <table className="rp-t rp-grid">
        <thead>
          <tr><th /><th>Measured</th>{hasTargets && <th>Target</th>}<th>Residual</th><th>Limit exc / acc</th><th>Status</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k}>
              <th>{r.k}</th><td>{r.m}</td>{hasTargets && <td>{r.t}</td>}<td className="num">{r.res}</td><td>{r.l}</td>
              <td className={`rp-g ${gClass[r.g]}`}>{gLabel[r.g]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="rp-small">
        Angularity readings are coupling gap per coupling diameter; residual angularity is slope (gap ÷ diameter).
        {hasTargets ? " Residual = measured − target (cold offsets for thermal growth)." : " No targets set: aligning to zero."}
        {" "}Limits {inp.tol ? "overridden by user" : "speed-based (general field guidance)"}.
      </p>

      <h2>Foot corrections — {meta.movable}</h2>
      <table className="rp-t rp-grid">
        <thead><tr><th>Foot</th><th>From coupling</th><th>Vertical (shims)</th><th>Horizontal (move)</th></tr></thead>
        <tbody>
          <tr><th>Front</th><td>{fmt(dL(R.l1), u.met ? 0 : 1)} {uLen}</td><td>{vMove(R.feet.frontV)}</td><td>{hMove(R.feet.frontH)}</td></tr>
          <tr><th>Back</th><td>{fmt(dL(R.l2), u.met ? 0 : 1)} {uLen}</td><td>{vMove(R.feet.backV)}</td><td>{hMove(R.feet.backH)}</td></tr>
        </tbody>
      </table>

      <div className="rp-drawings">
        <Centerline axis="vertical" title="SIDE ELEVATION" offset={R.rOffV} slope={R.rSlopeV} {...drawing}
          feet={[{ a: R.l1, m: R.feet.frontV, t: cb.v(R.feet.frontV) }, { a: R.l2, m: R.feet.backV, t: cb.v(R.feet.backV) }]}
          orient={`offset ${sgnS(R.rOffV)} ${uSm}`} offsetTxt={fmt(dS(R.rOffV), smDec)} gapVal={gV.val} open={gV.open} />
        <Centerline axis="horizontal" title="PLAN VIEW" offset={R.rOffH} slope={R.rSlopeH} {...drawing}
          feet={[{ a: R.l1, m: R.feet.frontH, t: cb.h(R.feet.frontH) }, { a: R.l2, m: R.feet.backH, t: cb.h(R.feet.backH) }]}
          orient={`up = ${right}`} offsetTxt={fmt(dS(R.rOffH), smDec)} gapVal={gH.val} open={gH.open} />
      </div>
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
