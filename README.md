# Shaft Alignment

Gap & offset (laser) shaft alignment calculator: enter as-found readings for the movable
machine, get foot corrections (shims and horizontal moves), an alignment view, and a
speed-based tolerance check.

- **Saved jobs** — every job auto-saves in the browser on the device you're using. Tap the
  job name to switch jobs; **Duplicate** a job to record as-left readings next to as-found.
- **Export / Import** — download one job or all jobs as a `.json` file (a backup, or to move
  jobs to another device), and load them back. Importing never overwrites a newer edit.
- **Report** — prints a one-page report (readings, tolerance, foot moves, drawings, notes,
  sign-off lines). Choose **Save as PDF** in the print dialog; on iPhone/iPad use
  Share → Print, then Share again from the preview.
- **Offline / install** — after the first visit the app works with no connection. Install
  it from the browser (Chrome/Edge: install icon in the address bar; iPhone Safari:
  Share → Add to Home Screen; Android Chrome: menu → Install app).

> Jobs live in *this browser's* storage — not synced between devices, and cleared if you
> clear site data. Use **Export all** regularly to keep a backup file.

## Run it

Requires [Node.js](https://nodejs.org) 20 or newer. In PowerShell (or any terminal):

```powershell
git clone https://github.com/nthalizard/automatic-disco.git
cd automatic-disco
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173). To open it from a phone on
the same Wi-Fi, run `npm run dev -- --host` and use the "Network" address instead.

| Command | What it does |
|---|---|
| `npm run dev` | Start the app with live reload |
| `npm test` | Run the math unit tests |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build into `dist/` (static files, host anywhere) |

## Layout

```
src/
  core/           pure math, no UI — this is what the tests cover
    alignment.ts    residuals, slopes, foot moves (sign conventions documented here)
    tolerance.ts    speed-based tolerance table, interpolation, grading
    units.ts        thou/in ↔ mm conversions
    format.ts       number parsing and formatting
    *.test.ts
  state/          jobs: model, evaluate (inputs → results), IndexedDB storage,
                  export/import format, useJobs hook (auto-save)
  components/     inputs, Centerline drawing, TolBar, FootRow, JobBar, JobsDialog,
                  JobDetails, Report (print-only)
  App.tsx         screen layout and state
  styles.ts, theme.ts
```

All internal math is imperial (thou, inches, thou/in); the unit toggle converts at the
edges. Any change to `src/core` should come with a test — a sign error here means shimming
the wrong way.
