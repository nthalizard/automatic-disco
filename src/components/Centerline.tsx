import { C, type Palette } from "../theme";

export interface FootCallout { a: number; m: number; t: string }

/* scaled shaft centerline, one plane */
export function Centerline({ axis, title, offset, slope, l1, l2, feet, orient, offsetTxt, trueScale, gapVal, gapUnit, open, movable, stationary, palette }: {
  axis: "vertical" | "horizontal"; title: string; offset: number; slope: number; l1: number; l2: number;
  feet: FootCallout[]; orient: string; offsetTxt: string; trueScale: boolean; gapVal: string; gapUnit: string; open: string;
  movable: string; stationary: string; palette?: Palette;
}) {
  const P = palette ?? C;
  const tag = (s: string) => (s.length > 18 ? s.slice(0, 17) + "…" : s).toUpperCase();
  const W = 520, H = 152, mL = 54, cX = 372, base = 112, midY = 62;
  const aS = (cX - mL) / Math.max(l2, 1e-6);
  const ym = Math.max(Math.abs(offset), Math.abs(offset + slope * l1), Math.abs(offset + slope * l2), 1e-6);
  const vS = trueScale ? aS / 1000 : (ym > 1e-6 ? 28 / ym : 0);
  const X = (a: number) => cX - a * aS, Yy = (a: number) => midY - (offset + slope * a) * vS;
  const exag = (!trueScale && aS > 0 && vS > 0) ? Math.round(vS * 1000 / aS) : 0;
  const scaleNote = trueScale ? "1:1 true" : (exag ? "vert ×" + exag : "flat");
  const colFoot = (m: number) => axis === "vertical" ? (Math.abs(m) < 1e-6 ? P.inkFaint : m > 0 ? P.ok : P.ink) : P.amber;
  const bx1 = X(l2) - 16, bx2 = X(l1) + 22;
  const mvY = Yy(0), showOff = Math.abs(offset) * vS > 2.5;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sa-cline" role="img" aria-label={title}>
      {/* machine bodies */}
      <rect x={bx1} y={base - 46} width={Math.max(bx2 - bx1, 30)} height={46} rx="4" fill={P.panel2} stroke={P.edge} />
      <rect x={cX + 40} y={base - 46} width={W - 16 - (cX + 40)} height={46} rx="4" fill={P.panel2} stroke={P.edge} />
      <text x={(bx1 + bx2) / 2} y={base - 33} className="sa-cl-body" textAnchor="middle">{tag(movable)}</text>
      <text x={(cX + 40 + W - 16) / 2} y={base - 33} className="sa-cl-body" textAnchor="middle">{tag(stationary)}</text>
      {/* ground */}
      <line x1={mL - 8} y1={base} x2={W - 12} y2={base} stroke={P.edgeSoft} />
      {/* stationary datum shaft */}
      <line x1={cX + 6} y1={midY} x2={cX + 46} y2={midY} stroke={P.inkDim} strokeWidth="3" strokeLinecap="round" />
      <line x1={mL} y1={midY} x2={cX + 6} y2={midY} stroke={P.inkFaint} strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
      {/* movable shaft */}
      <line x1={X(0)} y1={Yy(0)} x2={X(l2)} y2={Yy(l2)} stroke={P.shaft} strokeWidth="3" strokeLinecap="round" />
      {/* coupling + gap readout */}
      <line x1={cX} y1={44} x2={cX} y2={base - 2} stroke={P.inkFaint} strokeWidth="1" strokeDasharray="3 3" />
      <rect x={cX - 55} y={13} width="110" height="24" rx="4" fill={P.panel} stroke={P.edge} />
      <text x={cX} y={23} className="sa-cl-gaplbl" textAnchor="middle">COUPLING GAP</text>
      <text x={cX} y={33} className="sa-cl-gap" textAnchor="middle">{gapVal} {gapUnit} · {open}</text>
      {/* offset arrow at coupling */}
      {showOff && (<g>
        <line x1={cX - 8} y1={midY} x2={cX - 8} y2={mvY} stroke={P.amber} strokeWidth="1" />
        <line x1={cX - 11} y1={midY} x2={cX - 5} y2={midY} stroke={P.amber} strokeWidth="1" />
        <line x1={cX - 11} y1={mvY} x2={cX - 5} y2={mvY} stroke={P.amber} strokeWidth="1" />
        <text x={cX - 13} y={(midY + mvY) / 2 + 3} className="sa-cl-off" textAnchor="end">{offsetTxt}</text>
      </g>)}
      {/* feet */}
      {feet.map((f, i) => {
        const fx = X(f.a), fy = Yy(f.a);
        return (<g key={i}>
          <line x1={fx} y1={fy} x2={fx} y2={base} stroke={P.inkFaint} strokeWidth="1.5" />
          <circle cx={fx} cy={fy} r="3" fill={P.shaft} stroke={P.bg} strokeWidth="1" />
          <rect x={fx - 7} y={base} width="14" height="4" fill={P.inkFaint} />
          <text x={fx} y={base + 15} className="sa-cl-call" textAnchor="middle" fill={colFoot(f.m)}>{f.t}</text>
        </g>);
      })}
      {/* labels */}
      <text x={mL - 8} y={16} className="sa-cl-title">{title}</text>
      <text x={W - 12} y={H - 5} className="sa-cl-meta" textAnchor="end">{orient} · {scaleNote}</text>
    </svg>
  );
}
