import { fmt } from "../core/format";
import { C } from "../theme";

export function FootRow({ name, dist, du, um, eps, v, h }: {
  name: string; dist: number; du: string; um: string; eps: number; v: number; h: number;
}) {
  const vz = Math.abs(v) < eps, hz = Math.abs(h) < eps;
  const vTxt = vz ? "no change" : v > 0 ? `ADD ${fmt(v)}` : `REMOVE ${fmt(-v)}`;
  const hTxt = hz ? "no change" : h > 0 ? `${fmt(h)} →` : `${fmt(-h)} ←`;
  return (
    <div className="sa-foot-r">
      <span className="sa-foot-name">{name}<em>{fmt(dist, 0)} {du}</em></span>
      <span className="sa-foot-v" style={{ color: vz ? C.inkFaint : v > 0 ? C.ok : C.ink }}>{vTxt}{!vz && <small>{um}</small>}</span>
      <span className="sa-foot-v" style={{ color: hz ? C.inkFaint : C.amber }}>{hTxt}{!hz && <small>{um}</small>}</span>
    </div>
  );
}
