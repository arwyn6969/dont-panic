# DON'T PANIC

A browser console for Infocom's *The Hitchhiker's Guide to the Galaxy* (1984), with a 1981 BBC / Rod Lord-inspired interface: clickable verbs, compass, noun chips, Don't Panic hints, local save slots, and a chrome Guide overlay.

**Repo:** https://github.com/arwyn6969/dont-panic  
**Play:** https://arwyn6969.github.io/dont-panic/

## How to play

1. Click the cover (or wait a second) to start.
2. Type commands, or tap the verb keys, compass, hints, and nouns.
3. **Don't Panic mode** (on by default, remembered in this browser) shows a short scene note plus up to four context actions. It also keeps a *safe* autosave from before a lethal turn.
4. **The Guide** in the header is chrome — homage blurbs. It will only send `consult guide about …` once you actually have the in-game Guide.
5. Save / Restore uses three local slots plus an autosave. Progress lives in this browser only.

## World model

The console no longer guesses the room from the entire transcript. It reads the status-line location first, then the latest turn of output. That drives:

- `body[data-room]` and `body[data-ship]` (hooks for a later visual pass)
- `#art` / `#artCap` location plates
- `#notice` + `#hints` (max four)
- `#nouns`
- compass labels (N/E/S/W on Earth, FORE/STBD/AFT/PORT aboard ship)

`window.GuideConsole` exposes `submit`, `setArt`, `setHints`, `setGuide`, `scanWorld`, and `state` so a design agent can restyle without touching the matcher.

## Stack

- Infocom `s4.z3` from the [historicalsource](https://github.com/historicalsource/hitchhikersguide) snapshot (`COMPILED/s4.z3`)
- [ifvms](https://github.com/curiousdannii/ifvms.js) ZVM interpreter (jsDelivr)
- Custom MiniGlk shim plus Guide chrome (`guide-ui.js`, `guide.css`)

## Disclaimer

Private-use / friends project. The original Infocom story belongs to its rights holders. Do not treat this repo as a licensed redistribution. Get a license before selling anything.
