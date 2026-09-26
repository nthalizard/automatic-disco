import type { ReactNode } from "react";
import type { SignedReading } from "../state/job";

export function Panel({ title, hint, right, children }: { title: string; hint?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="sa-panel">
      <div className="sa-panel-head">
        <div className="sa-panel-title">{title}{hint && <span className="sa-panel-hint">{hint}</span>}</div>
        {right}
      </div>
      <div className="sa-panel-body">{children}</div>
    </div>
  );
}

export function Field({ label, unit, value, onChange, sub }: { label: string; unit: string; value: string; onChange: (v: string) => void; sub?: string }) {
  return (
    <label className="sa-fld">
      <span className="sa-fld-l">{label}{sub && <em>{sub}</em>}</span>
      <span className="sa-fld-in"><input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} /><i>{unit}</i></span>
    </label>
  );
}

export function Reading({ label, r, set, pos, neg, unit }: {
  label: string; r: SignedReading; set: (r: SignedReading) => void; pos: string; neg: string; unit: string;
}) {
  return (
    <div className="sa-read">
      <div className="sa-read-top">
        <span className="sa-read-l">{label}</span>
        <span className="sa-read-in"><input inputMode="decimal" value={r.mag} onChange={(e) => set({ ...r, mag: e.target.value })} /><i>{unit}</i></span>
      </div>
      <div className="seg">
        <button className={r.pos ? "seg-b on" : "seg-b"} onClick={() => set({ ...r, pos: true })}>{pos}</button>
        <button className={!r.pos ? "seg-b on" : "seg-b"} onClick={() => set({ ...r, pos: false })}>{neg}</button>
      </div>
    </div>
  );
}

export function TolCell({ v, onChange }: { v: number | string; onChange: (v: string) => void }) {
  const disp = typeof v === "number" ? String(+v.toFixed(3)) : v;
  return <span className="sa-tolcell"><input inputMode="decimal" value={disp} onChange={(e) => onChange(e.target.value)} /></span>;
}
