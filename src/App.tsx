import { useMemo, useState } from "react";
import { computeAlignment, type PlaneReading } from "./core/alignment";
import { fmt, num, sgn } from "./core/format";
import { grade, interpTol, worstGrade, type TolKey } from "./core/tolerance";
import { convertText, inToLen, lenToIn, smallToThou, thouToSmall, MM_PER_INCH, MM_PER_THOU, type Unit } from "./core/units";
import { Centerline } from "./components/Centerline";
import { FootRow } from "./components/FootRow";
import { gColor, gLabel } from "./components/grades";
import { Field, Panel, Reading, TolCell, type SignedReading } from "./components/inputs";
import { TolBar } from "./components/TolBar";
import { css } from "./styles";
import { C } from "./theme";

/*  Compressor 1 (movable / MTBM)  ->  Gearbox 2 (stationary).
    Inputs are held as typed text in the display unit; the core math runs in imperial. */

type TolOverride = Partial<Record<TolKey, string>> | null;

export default function App() {
  const [unit, setUnit] = useState<Unit>("imp");
  const [D, setD] = useState("6");
  const [L1, setL1] = useState("58.071");
  const [Ls, setLs] = useState("101.18");
  const [dbse, setDbse] = useState("1");
  const [rpm, setRpm] = useState("5846");
  const [voff, setVoff] = useState<SignedReading>({ mag: "55.8", pos: false });
  const [vgap, setVgap] = useState<SignedReading>({ mag: "68.4", pos: false });
  const [hoff, setHoff] = useState<SignedReading>({ mag: "69.1", pos: false });
  const [hgap, setHgap] = useState<SignedReading>({ mag: "76.7", pos: false });
  const [hflip, setHflip] = useState(false);
  const [trueScale, setTrueScale] = useState(false);
  const [showT, setShowT] = useState(false);
  const [tvoff, setTvoff] = useState<SignedReading>({ mag: "0", pos: true });
  const [tvgap, setTvgap] = useState<SignedReading>({ mag: "0", pos: true });
  const [thoff, setThoff] = useState<SignedReading>({ mag: "0", pos: true });
  const [thgap, setThgap] = useState<SignedReading>({ mag: "0", pos: true });
  const [tol, setTol] = useState<TolOverride>(null);
  const auto = useMemo(() => interpTol(num(rpm)), [rpm]);

  const met = unit === "met";
  const uLen = met ? "mm" : "in";
  const uSm = met ? "mm" : "thou";
  const uSl = met ? "mm/m" : "thou/in";
  const smDec = met ? 2 : 1;
  const dS = (thou: number) => thouToSmall(thou, unit);
  const dL = (inch: number) => inToLen(inch, unit);
  const sgnS = (thou: number, d = smDec) => sgn(dS(thou), d);
  const eps = met ? 0.005 : 0.05;

  const excOffI = tol?.eo != null ? smallToThou(num(tol.eo), unit) : auto.eo;
  const accOffI = tol?.ao != null ? smallToThou(num(tol.ao), unit) : auto.ao;
  const excAngI = tol?.ea != null ? num(tol.ea) : auto.ea;
  const accAngI = tol?.aa != null ? num(tol.aa) : auto.aa;

  const R = useMemo(() => {
    const s = (r: SignedReading) => smallToThou((r.pos ? 1 : -1) * num(r.mag), unit);
    const plane = (off: SignedReading, gap: SignedReading): PlaneReading => ({ offset: s(off), gap: s(gap) });
    const l1 = lenToIn(num(L1), unit);
    return computeAlignment({
      couplingDia: lenToIn(num(D), unit),
      frontFoot: l1,
      backFoot: lenToIn(num(L1) + num(Ls), unit),
      measured: { vertical: plane(voff, vgap), horizontal: plane(hoff, hgap) },
      target: { vertical: plane(tvoff, tvgap), horizontal: plane(thoff, thgap) },
      hflip,
    });
  }, [D, L1, Ls, voff, vgap, hoff, hgap, hflip, tvoff, tvgap, thoff, thgap, unit]);

  const gr = {
    offV: grade(R.rOffV, excOffI, accOffI), angV: grade(R.rSlopeV, excAngI, accAngI),
    offH: grade(R.rOffH, excOffI, accOffI), angH: grade(R.rSlopeH, excAngI, accAngI),
  };
  const overall = worstGrade(Object.values(gr));

  function switchUnit(target: Unit) {
    if (target === unit) return;
    const toMet = target === "met";
    const Lf = toMet ? MM_PER_INCH : 1 / MM_PER_INCH, Sf = toMet ? MM_PER_THOU : 1 / MM_PER_THOU;
    const ld = toMet ? 1 : 3, sd = toMet ? 3 : 1;
    const cvR = (r: SignedReading) => ({ ...r, mag: convertText(r.mag, Sf, sd) });
    setD(convertText(D, Lf, toMet ? 2 : 3)); setL1(convertText(L1, Lf, ld)); setLs(convertText(Ls, Lf, ld)); setDbse(convertText(dbse, Lf, toMet ? 2 : 3));
    setVoff(cvR(voff)); setVgap(cvR(vgap)); setHoff(cvR(hoff)); setHgap(cvR(hgap));
    setTvoff(cvR(tvoff)); setTvgap(cvR(tvgap)); setThoff(cvR(thoff)); setThgap(cvR(thgap));
    setTol(null); setUnit(target);
  }
  const tolCell = (key: TolKey, autoVal: number, isAng: boolean) => tol?.[key] != null ? tol[key] : (isAng ? autoVal : dS(autoVal));

  const gapReadout = (rGap: number, ax: "vertical" | "horizontal") => {
    const mag = Math.abs(dS(rGap));
    if (mag < eps) return { val: fmt(mag, smDec), open: "in-line" };
    const open = ax === "vertical" ? (rGap > 0 ? "open btm" : "open top") : (rGap > 0 ? "open left" : "open right");
    return { val: fmt(mag, smDec), open };
  };
  const gV = gapReadout(R.rGapV, "vertical"), gH = gapReadout(R.rGapH, "horizontal");

  // foot callout builders (used on the centerline drawing)
  const vTxt = (m: number) => Math.abs(dS(m)) < eps ? "—" : (m > 0 ? "▲ ADD " : "▼ REM ") + fmt(dS(Math.abs(m)), smDec);
  const hTxt = (m: number) => {
    if (Math.abs(dS(m)) < eps) return "—";
    const right = m > 0 ? !hflip : hflip;
    return (right ? "▶ " : "◀ ") + fmt(dS(Math.abs(m)), smDec);
  };

  return (
    <div className="sa-root">
      <style>{css}</style>
      <header className="sa-head">
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
          <span className="sa-node sa-node-mov">COMPRESSOR 1&nbsp;·&nbsp;MOVABLE</span>
          <span className="sa-line"><i /></span>
          <span className="sa-node">GEARBOX 2&nbsp;·&nbsp;STATIONARY</span>
        </div>
      </header>

      <div className="sa-grid">
        {/* INPUTS */}
        <section className="sa-col">
          <Panel title="Machine geometry" hint="reference plane = coupling center">
            <div className="sa-fields">
              <Field label="Coupling dia." unit={uLen} value={D} onChange={setD} />
              <Field label="Coupling → front foot" unit={uLen} value={L1} onChange={setL1} />
              <Field label="Front → back foot" unit={uLen} value={Ls} onChange={setLs} />
              <Field label="DBSE (shaft ends)" unit={uLen} value={dbse} onChange={setDbse} sub="reference only" />
              <Field label="Speed" unit="rpm" value={rpm} onChange={(v) => { setRpm(v); setTol(null); }} />
              <div className="sa-derived">back foot @ <b>{fmt(dL(R.l2), met ? 1 : 0)} {uLen}</b> from coupling</div>
            </div>
          </Panel>

          <Panel title="Measured readings" hint="as-found · parallelism = offset, angularity = gap">
            <Reading label="Vertical parallelism" r={voff} set={setVoff} unit={uSm} pos="Movable HIGH" neg="Movable LOW" />
            <Reading label="Vertical angularity" r={vgap} set={setVgap} unit={uSm + " / dia"} pos="Open at BOTTOM" neg="Open at TOP" />
            <div className="sa-sep" />
            <Reading label="Horizontal parallelism" r={hoff} set={setHoff} unit={uSm} pos="Movable RIGHT" neg="Movable LEFT" />
            <Reading label="Horizontal angularity" r={hgap} set={setHgap} unit={uSm + " / dia"} pos="Open at LEFT" neg="Open at RIGHT" />
            <label className="sa-check">
              <input type="checkbox" checked={hflip} onChange={(e) => setHflip(e.target.checked)} />
              <span>Reverse horizontal convention (viewpoint flipped)</span>
            </label>
          </Panel>

          <Panel title="Targets" hint={showT ? "cold offsets for thermal growth" : "aligning to zero"}
            right={<button className="sa-toggle-btn" onClick={() => setShowT(!showT)}>{showT ? "Hide" : "Set targets"}</button>}>
            {showT ? (
              <>
                <Reading label="Target V parallelism" r={tvoff} set={setTvoff} unit={uSm} pos="High" neg="Low" />
                <Reading label="Target V angularity" r={tvgap} set={setTvgap} unit={uSm + " / dia"} pos="Open bottom" neg="Open top" />
                <div className="sa-sep" />
                <Reading label="Target H parallelism" r={thoff} set={setThoff} unit={uSm} pos="Right" neg="Left" />
                <Reading label="Target H angularity" r={thgap} set={setThgap} unit={uSm + " / dia"} pos="Open left" neg="Open right" />
              </>
            ) : (
              <div className="sa-emptyhint">No targets set — corrections drive the shafts to zero (cold = hot).
                Set cold targets to pre-compensate measured thermal growth.</div>
            )}
          </Panel>

          <Panel title="Tolerance limits" hint={`speed-based · ${fmt(num(rpm), 0)} rpm`}
            right={tol ? <button className="sa-toggle-btn" onClick={() => setTol(null)}>Reset to speed</button> : null}>
            <div className="sa-tolgrid">
              <div className="sa-tolhead" />
              <div className="sa-tolhead" style={{ color: C.ok }}>EXCELLENT</div>
              <div className="sa-tolhead" style={{ color: C.warn }}>ACCEPTABLE</div>
              <div className="sa-tollabel">Offset ({uSm})</div>
              <TolCell v={tolCell("eo", auto.eo, false)} onChange={(v) => setTol({ ...(tol || {}), eo: v })} />
              <TolCell v={tolCell("ao", auto.ao, false)} onChange={(v) => setTol({ ...(tol || {}), ao: v })} />
              <div className="sa-tollabel">Angularity ({uSl})</div>
              <TolCell v={tolCell("ea", auto.ea, true)} onChange={(v) => setTol({ ...(tol || {}), ea: v })} />
              <TolCell v={tolCell("aa", auto.aa, true)} onChange={(v) => setTol({ ...(tol || {}), aa: v })} />
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
            <Centerline axis="vertical" title="SIDE ELEVATION" offset={R.rOffV} slope={R.rSlopeV}
              l1={R.l1} l2={R.l2} feet={[{ a: R.l1, m: R.feet.frontV, t: vTxt(R.feet.frontV) }, { a: R.l2, m: R.feet.backV, t: vTxt(R.feet.backV) }]}
              orient={`offset ${sgnS(R.rOffV)} ${uSm}`} offsetTxt={fmt(dS(R.rOffV), smDec)} trueScale={trueScale} gapVal={gV.val} gapUnit={uSm} open={gV.open} />
            <div className="sa-view-sep" />
            <Centerline axis="horizontal" title="PLAN VIEW" offset={R.rOffH} slope={R.rSlopeH}
              l1={R.l1} l2={R.l2} feet={[{ a: R.l1, m: R.feet.frontH, t: hTxt(R.feet.frontH) }, { a: R.l2, m: R.feet.backH, t: hTxt(R.feet.backH) }]}
              orient={`up = ${hflip ? "left" : "right"}`} offsetTxt={fmt(dS(R.rOffH), smDec)} trueScale={trueScale} gapVal={gH.val} gapUnit={uSm} open={gH.open} />
            <div className="sa-view-note">Scale toggle top-right: <b>EXAG</b> magnifies for readability; <b>1:1</b> shows true geometry (small misalignment looks nearly flat — that’s real). True numbers are in the callouts &amp; foot table.</div>
          </Panel>

          <Panel title="Foot corrections" hint="compressor (movable) · to reach target">
            <div className="sa-foot">
              <div className="sa-foot-h"><span>Foot</span><span>Vertical (shims)</span><span>Horizontal (move)</span></div>
              <FootRow name="Front" dist={dL(R.l1)} du={uLen} um={uSm} eps={eps} v={dS(R.feet.frontV)} h={dS(R.feet.frontH)} />
              <FootRow name="Back" dist={dL(R.l2)} du={uLen} um={uSm} eps={eps} v={dS(R.feet.backV)} h={dS(R.feet.backH)} />
            </div>
            <div className="sa-foot-legend">
              <span><b style={{ color: C.ok }}>+V</b> add shims (raise)&nbsp;·&nbsp;<b>−V</b> remove (lower)</span>
              <span><b style={{ color: C.amber }}>+H</b> toward {hflip ? "left" : "right"}&nbsp;·&nbsp;<b>−H</b> toward {hflip ? "right" : "left"}</span>
            </div>
          </Panel>

          <Panel title="Tolerance" hint={`residual vs limits · ${fmt(num(rpm), 0)} rpm`}>
            <TolBar label="Offset V" v={R.rOffV} exc={excOffI} acc={accOffI} status={gr.offV} txt={sgnS(R.rOffV)} lim={fmt(dS(accOffI), smDec)} unit={uSm} />
            <TolBar label="Angle V" v={R.rSlopeV} exc={excAngI} acc={accAngI} status={gr.angV} txt={sgn(R.rSlopeV, 2)} lim={fmt(accAngI, 2)} unit={uSl} />
            <TolBar label="Offset H" v={R.rOffH} exc={excOffI} acc={accOffI} status={gr.offH} txt={sgnS(R.rOffH)} lim={fmt(dS(accOffI), smDec)} unit={uSm} />
            <TolBar label="Angle H" v={R.rSlopeH} exc={excAngI} acc={accAngI} status={gr.angH} txt={sgn(R.rSlopeH, 2)} lim={fmt(accAngI, 2)} unit={uSl} />
            <div className="sa-bar-cap"><b style={{ color: C.ok }}>green</b> ≤ excellent · <b style={{ color: C.warn }}>amber</b> ≤ acceptable · <b style={{ color: C.bad }}>red</b> beyond · marker = residual (signed), tick = 0 / at-target</div>
          </Panel>
        </section>
      </div>

      <footer className="sa-foot-note">
        Slope = gap ÷ coupling dia. Corrections assume a rigid movable machine and corrected soft foot.
        Verify sign conventions against your laser tool before shimming.
      </footer>
    </div>
  );
}
