import { useEffect } from "react";
import type { Job } from "../state/job";
import { evaluate } from "../state/evaluate";
import { sortJobs } from "../state/storage";
import { gColor } from "./grades";

const when = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

export function JobsDialog({ jobs, currentId, onOpen, onDelete, onExportAll, onImport, onClose }: {
  jobs: Job[]; currentId: string | null;
  onOpen: (id: string) => void; onDelete: (job: Job) => void;
  onExportAll: () => void; onImport: () => void; onClose: () => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  return (
    <div className="sa-modal-bg" onClick={onClose}>
      <div className="sa-modal" role="dialog" aria-label="Saved jobs" onClick={(e) => e.stopPropagation()}>
        <div className="sa-panel-head">
          <div className="sa-panel-title">Saved jobs<span className="sa-panel-hint">{jobs.length} on this device · newest first</span></div>
          <button className="sa-toggle-btn" onClick={onClose}>Close</button>
        </div>
        <ul className="sa-joblist">
          {sortJobs(jobs).map((j) => {
            const g = evaluate(j.inputs).overall;
            return (
              <li key={j.id} className={j.id === currentId ? "on" : ""}>
                <button className="sa-joblist-open" onClick={() => onOpen(j.id)}>
                  <span className="sa-status-dot sm" style={{ background: gColor[g] }} />
                  <span className="sa-joblist-txt">
                    <b>{j.meta.name || "Untitled job"}</b>
                    <em>{[`${j.meta.movable} → ${j.meta.stationary}`, j.meta.site].filter(Boolean).join(" · ")}</em>
                    <em>edited {when(j.updatedAt)}</em>
                  </span>
                </button>
                <button className="sa-joblist-del" onClick={() => onDelete(j)} aria-label={`Delete ${j.meta.name || "job"}`}>Delete</button>
              </li>
            );
          })}
        </ul>
        <div className="sa-modal-foot">
          <span className="sa-emptyhint">Jobs are kept in this browser only. Export regularly to keep a backup file.</span>
          <div className="sa-modal-actions">
            <button className="sa-toggle-btn" onClick={onImport}>Import file</button>
            <button className="sa-toggle-btn sa-accent" onClick={onExportAll}>Export all</button>
          </div>
        </div>
      </div>
    </div>
  );
}
