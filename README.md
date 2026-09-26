# Shaft Alignment

Gap & offset (laser) shaft alignment calculator: enter as-found readings for the movable
machine, get foot corrections (shims and horizontal moves), an alignment view, and a
speed-based tolerance check.

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
  components/     Panel/Field/Reading inputs, Centerline drawing, TolBar, FootRow
  App.tsx         screen layout and state
  styles.ts, theme.ts
```

All internal math is imperial (thou, inches, thou/in); the unit toggle converts at the
edges. Any change to `src/core` should come with a test — a sign error here means shimming
the wrong way.
