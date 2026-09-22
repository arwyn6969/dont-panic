# DON'T PANIC

A browser console for Infocom's *The Hitchhiker's Guide to the Galaxy* (1984), with a 1981 BBC / Rod Lord-inspired interface: clickable verbs, compass, noun chips, Don't Panic hints, local save slots, and responsive play panels for desktop and mobile.

**Repo:** https://github.com/arwyn6969/dont-panic  
**Play (after Pages is on):** https://arwyn6969.github.io/dont-panic/

## Turn hosting on (one click)

GitHub will not publish the site until Pages is enabled on this repo:

1. Open [Settings → Pages](https://github.com/arwyn6969/dont-panic/settings/pages)
2. Under **Build and deployment → Source**, choose **GitHub Actions**
3. Wait for the `Deploy to GitHub Pages` workflow to go green
4. Open https://arwyn6969.github.io/dont-panic/

You can also pick **Deploy from a branch** → `main` / `/ (root)` if Actions is blocked.

## How to play

1. Click the cover (or wait a second) to start.
2. Type commands, or tap the verb keys, compass, hints, and nouns.
3. **Don't Panic mode** (on by default) shows context hints and can restore you from death using autosave.
4. Save / Restore uses three local slots plus an autosave. Progress lives in this browser only.

## Responsive layout

The console is designed for desktop and mobile play:

- The location artwork stays contained within its panel instead of being cropped or pushed off-screen.
- The transcript wraps long lines and remains independently scrollable.
- Portrait mobile screens use a compact stacked layout with touch-friendly controls.
- The Guide panel stays hidden until an actual Guide entry is requested, leaving more room for the game transcript at startup.

## Stack

- Infocom `s4.z3` from the [historicalsource](https://github.com/historicalsource/hitchhikersguide) snapshot (`COMPILED/s4.z3`)
- [ifvms](https://github.com/curiousdannii/ifvms.js) ZVM interpreter (jsDelivr)
- Custom MiniGlk shim plus Guide chrome (`guide-ui.js`, `guide.css`)

## Disclaimer

Private-use / friends project. The original Infocom story belongs to its rights holders. Do not treat this repo as a licensed redistribution. Get a license before selling anything.
