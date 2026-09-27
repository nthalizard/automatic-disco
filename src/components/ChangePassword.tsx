import { useEffect, useState, type FormEvent } from "react";
import { MIN_PASSWORD_LENGTH } from "../state/lock";

export function ChangePassword({ onChange, onClose, onDone }: {
  onChange: (current: string, next: string, confirm: string) => Promise<string | null>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose, busy]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const problem = await onChange(cur, next, again);
    setBusy(false);
    if (problem) setErr(problem); else onDone();
  };
  const field = (label: string, v: string, set: (s: string) => void, ac: string, autoFocus = false) => (
    <label className="sa-fld">
      <span className="sa-fld-l">{label}</span>
      <span className="sa-fld-in"><input className="sa-txt" type="password" value={v} autoFocus={autoFocus} autoComplete={ac}
        onChange={(e) => set(e.target.value)} /></span>
    </label>
  );
  return (
    <div className="sa-modal-bg" onClick={() => !busy && onClose()}>
      <form className="sa-modal" role="dialog" aria-label="Change password" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="sa-panel-head">
          <div className="sa-panel-title">Change password<span className="sa-panel-hint">re-encrypts every job on this device</span></div>
          <button type="button" className="sa-toggle-btn" onClick={onClose} disabled={busy}>Cancel</button>
        </div>
        <div className="sa-panel-body sa-lock-form">
          {field("Current password", cur, setCur, "current-password", true)}
          {field(`New password (at least ${MIN_PASSWORD_LENGTH} characters)`, next, setNext, "new-password")}
          {field("New password again", again, setAgain, "new-password")}
          {err && <div className="sa-lock-err" role="alert">{err}</div>}
          <button className="sa-lock-go" disabled={busy || !cur || !next}>{busy ? "Re-encrypting…" : "Change password"}</button>
        </div>
      </form>
    </div>
  );
}
