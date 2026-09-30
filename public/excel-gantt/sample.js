// Sample plan: a gearbox (bull gear & pinion) bearing replacement, run round the clock.
// Used for the in-browser demo and for "Create sample sheet" in Excel.

const S = (name) => ({ name, summary: true });
const T = (name, duration) => ({ name, duration });

const OUTLINE = [
  T("Positive Isolation Safe work permit issued", 0),
  S("Disassembly"),
  T("Dismantle Coupling guards and vent & Drain Piping", 3),
  T("Disconnect HSS & LSS couplings", 3),
  T("Dismantle Vibration Probes", 1),
  T("Alignment Verification", 3),
  T("Remove Split Line Bolts of Top Casing", 2),
  T("Remove Top casing (Lifting)", 2),
  T("Soft Blue check", 2),
  T("Disconnect RTD from JB", 1),
  T("Remove Top Bearing half", 3),
  T("Remove Bull Gear and Pinion (Lifting)", 3),
  T("Remove bottom Half Bearing", 2),
  S("Inspection & cleaning"),
  T("Inspect and clean", 4),
  S("Re Assembly"),
  T("Install bottom Half Bearing", 2),
  T("Install Bull Gear and Pinion (Lifting)", 3),
  T("Install Top Bearing half", 3),
  T("Contact checking between Housing and New Bearing", 6),
  T("Contact between New bearing and Shaft", 6),
  T("Soft Blue Check (Contact Check)", 2),
  T("Reconnect RTD to JB", 2),
  T("Install Top casing (Lifting)", 4),
  T("Install Split Line Bolts of Top Casing", 4),
  T("Install Vibration Probes", 3),
  T("Alignment verification Only", 4),
  T("Assemble HSS & LSS couplings", 4),
  T("Install Coupling guards", 6),
];

/** Rows in table order; every task follows the previous one (Finish-to-Start). */
export function sampleRows() {
  let prev = "";
  let inSummary = false;
  return OUTLINE.map((t, i) => {
    const id = String(i + 1);
    if (t.summary) inSummary = true;
    const row = {
      id,
      name: t.name,
      level: t.summary || !inSummary ? 0 : 1,
      duration: t.summary ? "" : t.duration,
      preds: t.summary ? "" : prev,
      fixedStart: null,
      pct: 0,
    };
    if (!t.summary) prev = id;
    return row;
  });
}

/** Next Monday 07:00 (naive wall-clock ms), as a sensible default project start. */
export function nextMondayMorning(now = new Date()) {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 7));
  const add = (8 - d.getUTCDay()) % 7 || 7;
  return d.getTime() + add * 86_400_000;
}
