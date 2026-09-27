# Shaft Alignment

Gap & offset (laser) shaft alignment calculator: enter as-found readings for the movable
machine, get foot corrections (shims and horizontal moves), an alignment view, and a
speed-based tolerance check.

- **Saved jobs** — every job auto-saves in the browser on the device you're using. Tap the
  job name to switch jobs; **Duplicate** copies a job as a starting point for a similar one.
- **As-found / as-left** — switch the readings panel to **AS-LEFT** after making the moves
  to record the final readings in the same job. The report shows both side by side.
- **Tolerance presets** — type an OEM or site spec into the limit cells and **Save as
  preset**; pick it under "Limits from" on any job. Presets are included in **Export all**.
- **Export / Import** — download one job, or all jobs plus presets, as a `.json` file (a backup, or to move
  jobs to another device), and load them back. Importing never overwrites a newer edit.
- **Report** — prints a one-page report (readings, tolerance, foot moves, drawings, notes,
  sign-off lines). Choose **Save as PDF** in the print dialog; on iPhone/iPad use
  Share → Print, then Share again from the preview.
- **Offline / install** — after the first visit the app works with no connection. Install
  it from the browser (Chrome/Edge: install icon in the address bar; iPhone Safari:
  Share → Add to Home Screen; Android Chrome: menu → Install app).

- **Password lock** — on first open you set a password (10+ characters; a few random words
  works well). Jobs and presets are encrypted on the device with it (AES-GCM, key from
  PBKDF2-SHA-256 × 600k), so they're unreadable without it — even to someone who reads this
  public code or copies the browser's storage. **Lock** locks now; the app also locks after
  10 minutes in the background. Change the password from the jobs list. **There is no
  recovery**: a forgotten password can only be cleared by erasing the jobs on that device —
  keep **Export all** backups (export files are *not* encrypted; store them safely).
  The lock protects your saved data, not the public page itself: anyone can load the empty
  calculator.

> Jobs live in *this browser's* storage — not synced between devices, and cleared if you
> clear site data. Use **Export all** regularly to keep a backup file.

## Use it online

After GitHub Pages is switched on (below), the app is at
**https://nthalizard.github.io/automatic-disco/** — open it on a phone and install it from
there. Every push to the default branch redeploys it (`.github/workflows/pages.yml`).

One-time setup: repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
GitHub Pages needs the repo to be public on a free account (private repos need GitHub Pro).
The published site is public either way; it contains only the app — jobs never leave the
browser they were entered in.

## Run it locally

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
  state/          jobs: model (incl. as-left), evaluate (inputs → results), tolerance
                  presets, IndexedDB storage, export/import format, useJobs hook
  components/     inputs, Centerline drawing, TolBar, FootRow, JobBar, JobsDialog,
                  JobDetails, Report (print-only)
  App.tsx         screen layout and state
  styles.ts, theme.ts
```

All internal math is imperial (thou, inches, thou/in); the unit toggle converts at the
edges. Any change to `src/core` should come with a test — a sign error here means shimming
the wrong way.
