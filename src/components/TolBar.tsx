import type { Grade } from "../core/tolerance";
import { C } from "../theme";
import { gColor } from "./grades";

/* bipolar tolerance bar */
export function TolBar({ label, v, exc, acc, status, txt, lim, unit }: {
  label: string; v: number; exc: number; acc: number; status: Grade; txt: string; lim: string; unit: string;
}) {
  const trackMax = Math.max(acc * 1.25, exc * 1.4, 1e-6);
  const gW = exc / trackMax * 50, aW = acc / trackMax * 50;
  const grad = `linear-gradient(90deg,${C.bad}26 0 ${50 - aW}%,${C.warn}26 ${50 - aW}% ${50 - gW}%,${C.ok}2e ${50 - gW}% ${50 + gW}%,${C.warn}26 ${50 + gW}% ${50 + aW}%,${C.bad}26 ${50 + aW}% 100%)`;
  const mp = 50 + Math.max(-1, Math.min(1, v / trackMax)) * 50;
  const over = Math.abs(v) > trackMax;
  const col = gColor[status];
  return (
    <div className="sa-bar-row">
      <span className="sa-bar-l">{label}</span>
      <div className="sa-bar-track" style={{ background: grad }}>
        <span className="sa-bar-zero" />
        <span className="sa-bar-mark" style={{ left: `${mp}%`, background: col, boxShadow: `0 0 6px ${col}` }} />
        {over && <span className="sa-bar-over" style={{ color: col, [v > 0 ? "right" : "left"]: "2px" }}>{v > 0 ? "›" : "‹"}</span>}
      </div>
      <span className="sa-bar-v" style={{ color: col }}>{txt}<em> / {lim} {unit}</em></span>
    </div>
  );
}
