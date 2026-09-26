import type { JobMeta } from "../state/job";
import { Panel } from "./inputs";

function Text({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="sa-fld">
      <span className="sa-fld-l">{label}</span>
      <span className="sa-fld-in"><input className="sa-txt" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></span>
    </label>
  );
}

export function JobDetails({ meta, set, open, setOpen }: {
  meta: JobMeta; set: (patch: Partial<JobMeta>) => void; open: boolean; setOpen: (v: boolean) => void;
}) {
  const summary = [meta.site, meta.technician].filter(Boolean).join(" · ") || "no site / technician";
  return (
    <Panel title="Job details" hint={open ? "shown on the report" : summary}
      right={<button className="sa-toggle-btn" onClick={() => setOpen(!open)}>{open ? "Hide" : "Edit"}</button>}>
      {open ? (
        <div className="sa-fields">
          <div className="sa-span2"><Text label="Job name" value={meta.name} onChange={(v) => set({ name: v })} placeholder="e.g. P-101A as-found" /></div>
          <Text label="Movable machine" value={meta.movable} onChange={(v) => set({ movable: v })} />
          <Text label="Stationary machine" value={meta.stationary} onChange={(v) => set({ stationary: v })} />
          <Text label="Site / area" value={meta.site} onChange={(v) => set({ site: v })} />
          <Text label="Technician" value={meta.technician} onChange={(v) => set({ technician: v })} />
          <label className="sa-fld sa-span2">
            <span className="sa-fld-l">Notes</span>
            <textarea className="sa-notes" rows={3} value={meta.notes} onChange={(e) => set({ notes: e.target.value })}
              placeholder="Soft foot, pipe strain, bolt-bound, shim stock used…" />
          </label>
        </div>
      ) : (
        <div className="sa-emptyhint">{meta.movable} (movable) → {meta.stationary} (stationary)</div>
      )}
    </Panel>
  );
}
