import type { SaveState } from "../state/useJobs";

export function JobBar({ name, saveState, persistent, onJobs, onNew, onDuplicate, onExport, onImport, onReport }: {
  name: string; saveState: SaveState; persistent: boolean;
  onJobs: () => void; onNew: () => void; onDuplicate: () => void;
  onExport: () => void; onImport: () => void; onReport: () => void;
}) {
  const status = !persistent ? { t: "not saved — browser storage off", c: "bad" }
    : saveState === "error" ? { t: "save failed", c: "bad" }
    : saveState === "saving" ? { t: "saving…", c: "dim" }
    : { t: "saved on this device", c: "dim" };
  return (
    <div className="sa-jobbar">
      <button className="sa-jobbar-name" onClick={onJobs} title="Open saved jobs">
        <span className="sa-jobbar-k">JOB</span>
        <span className="sa-jobbar-v">{name || "Untitled job"}</span>
        <span className="sa-jobbar-caret">▾</span>
      </button>
      <span className={`sa-jobbar-status ${status.c}`}>{status.t}</span>
      <div className="sa-jobbar-actions">
        <button className="sa-toggle-btn" onClick={onNew}>New</button>
        <button className="sa-toggle-btn" onClick={onDuplicate} title="Copy this job, e.g. to record as-left readings">Duplicate</button>
        <button className="sa-toggle-btn" onClick={onExport} title="Download this job as a .json file">Export</button>
        <button className="sa-toggle-btn" onClick={onImport} title="Load jobs from a .json file">Import</button>
        <button className="sa-toggle-btn sa-accent" onClick={onReport} title="Print or save as PDF">Report</button>
      </div>
    </div>
  );
}
