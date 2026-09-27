import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createLock, MIN_PASSWORD_LENGTH, passwordProblem, unlock, type LockMeta } from "../state/lock";
import {
  countPlainRecords, encryptedStore, eraseDevice, getLock, memoryStore, openDevice, rekey, setupLock, type JobStore,
} from "../state/storage";
import { css } from "../styles";

/** Lock again after the app has been in the background this long. */
export const AUTO_LOCK_MS = 10 * 60 * 1000;

export interface Session {
  store: JobStore;
  /** false when the browser has no storage (nothing saved, so nothing to lock) */
  locked: boolean;
  lock: () => void;
  /** returns an error message, or null on success */
  changePassword: (current: string, next: string, confirm: string) => Promise<string | null>;
}

type Phase =
  | { k: "loading" }
  | { k: "setup"; db: IDBDatabase; existing: number }
  | { k: "locked"; db: IDBDatabase; meta: LockMeta }
  | { k: "erase"; db: IDBDatabase; meta: LockMeta }
  | { k: "open"; session: Session };

function Pw({ label, value, onChange, autoFocus, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean; autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="sa-fld">
      <span className="sa-fld-l">{label}</span>
      <span className="sa-fld-in">
        <input className="sa-txt" type={show ? "text" : "password"} value={value} autoFocus={autoFocus}
          autoComplete={autoComplete} autoCapitalize="off" autoCorrect="off" spellCheck={false}
          onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="sa-pw-eye" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}>
          {show ? "HIDE" : "SHOW"}
        </button>
      </span>
    </label>
  );
}

function Screen({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="sa-root sa-screen">
      <style>{css}</style>
      <div className="sa-lock">
        <div className="sa-eyebrow">Rotating Equipment · Precision Alignment</div>
        <h1 className="sa-title">Shaft Alignment</h1>
        <div className="sa-panel sa-lock-panel">
          <div className="sa-panel-head"><div className="sa-panel-title">{title}<span className="sa-panel-hint">{sub}</span></div></div>
          <div className="sa-panel-body">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Password gate in front of the app: nothing is decrypted until the right password is entered. */
export function LockGate({ children }: { children: (s: Session) => ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ k: "loading" });
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dbRef = useRef<IDBDatabase | null>(null);

  const toLocked = useCallback(async (db: IDBDatabase) => {
    const meta = await getLock(db);
    setPw(""); setPw2(""); setErr(null); setBusy(false);
    setPhase(meta ? { k: "locked", db, meta } : { k: "setup", db, existing: await countPlainRecords(db) });
  }, []);

  const lock = useCallback(() => { if (dbRef.current) void toLocked(dbRef.current); }, [toLocked]);

  const openSession = useCallback((db: IDBDatabase, meta: LockMeta, key: CryptoKey) => {
    const keyRef = { current: key };
    let current = meta;
    const session: Session = {
      store: encryptedStore(db, keyRef),
      locked: true,
      lock,
      changePassword: async (oldPw, next, confirm) => {
        const problem = passwordProblem(next, confirm);
        if (problem) return problem;
        if (!(await unlock(current, oldPw))) return "The current password is wrong.";
        const fresh = await createLock(next);
        try {
          await rekey(db, keyRef.current, fresh.meta, fresh.key);
        } catch {
          return "Couldn't change the password — nothing was changed. Try again.";
        }
        keyRef.current = fresh.key;
        current = fresh.meta;
        return null;
      },
    };
    setPw(""); setPw2(""); setErr(null); setBusy(false);
    setPhase({ k: "open", session });
  }, [lock]);

  useEffect(() => {
    let alive = true;
    openDevice().then((db) => {
      if (!alive) return;
      dbRef.current = db;
      if (!db) {
        // no browser storage: nothing is saved, so there is nothing to protect
        setPhase({ k: "open", session: { store: memoryStore(), locked: false, lock: () => {}, changePassword: async () => "Storage is off in this browser." } });
        return;
      }
      void toLocked(db);
    });
    return () => { alive = false; };
  }, [toLocked]);

  // auto-lock after a while in the background
  const open = phase.k === "open" && phase.session.locked;
  useEffect(() => {
    if (!open) return;
    let hiddenAt: number | null = null;
    const onVis = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt !== null && Date.now() - hiddenAt > AUTO_LOCK_MS) lock();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [open, lock]);

  if (phase.k === "open") return <>{children(phase.session)}</>;
  if (phase.k === "loading") return <Screen title="Loading" sub="opening storage on this device">…</Screen>;

  if (phase.k === "setup") {
    const { db, existing } = phase;
    const submit = async (e: FormEvent) => {
      e.preventDefault();
      const problem = passwordProblem(pw, pw2);
      if (problem) return setErr(problem);
      setBusy(true); setErr(null);
      try {
        const { meta, key } = await createLock(pw);
        await setupLock(db, meta, key);
        openSession(db, meta, key);
      } catch {
        setBusy(false); setErr("Couldn't save the password on this device. Try again.");
      }
    };
    return (
      <Screen title="Set a password" sub="protects the jobs saved on this device">
        <form onSubmit={submit} className="sa-lock-form">
          <Pw label="New password" value={pw} onChange={setPw} autoFocus autoComplete="new-password" />
          <Pw label="Type it again" value={pw2} onChange={setPw2} autoComplete="new-password" />
          {err && <div className="sa-lock-err" role="alert">{err}</div>}
          <button className="sa-lock-go" disabled={busy}>{busy ? "Encrypting…" : "Set password"}</button>
          <ul className="sa-lock-notes">
            <li>At least {MIN_PASSWORD_LENGTH} characters. Easy to remember, hard to guess: a few random words, e.g. <i>copper-lathe-rainy-orbit</i>.</li>
            <li>Your jobs and presets are encrypted with it on this device{existing ? ` — the ${existing} item${existing > 1 ? "s" : ""} already saved will be encrypted now` : ""}.</li>
            <li><b>There is no password recovery.</b> If you forget it, the saved jobs on this device can't be opened. Use <b>Export all</b> now and then to keep a backup file.</li>
          </ul>
        </form>
      </Screen>
    );
  }

  if (phase.k === "erase") {
    const { db, meta } = phase;
    const erase = async () => {
      setBusy(true);
      await eraseDevice(db);
      await toLocked(db);
    };
    return (
      <Screen title="Forgot password?" sub="there is no way to recover it">
        <div className="sa-lock-form">
          <p className="sa-lock-p">The jobs on this device are encrypted with the password and can't be opened without it.
            You can erase them and start over — then import a backup file if you have one.</p>
          <button className="sa-lock-go danger" disabled={busy} onClick={erase}>{busy ? "Erasing…" : "Erase all jobs on this device"}</button>
          <button className="sa-linkbtn" onClick={() => setPhase({ k: "locked", db, meta })}>Back — I remember it</button>
        </div>
      </Screen>
    );
  }

  const { db, meta } = phase;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pw) return;
    setBusy(true); setErr(null);
    const key = await unlock(meta, pw);
    if (!key) {
      setBusy(false); setPw(""); setErr("Wrong password.");
      return;
    }
    openSession(db, meta, key);
  };
  return (
    <Screen title="Locked" sub="enter your password to open your jobs">
      <form onSubmit={submit} className="sa-lock-form">
        <Pw label="Password" value={pw} onChange={setPw} autoFocus autoComplete="current-password" />
        {err && <div className="sa-lock-err" role="alert">{err}</div>}
        <button className="sa-lock-go" disabled={busy || !pw}>{busy ? "Unlocking…" : "Unlock"}</button>
        <button type="button" className="sa-linkbtn" onClick={() => { setErr(null); setPhase({ k: "erase", db, meta }); }}>Forgot password?</button>
      </form>
    </Screen>
  );
}
