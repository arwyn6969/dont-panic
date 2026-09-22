# DON'T PANIC

A browser console for Infocom's *The Hitchhiker's Guide to the Galaxy* (1984), with a 1981 BBC / Rod Lord-inspired interface: clickable verbs, compass, noun chips, Don't Panic hints, and local save slots.

**Play:** [https://arwyn6969.github.io/dont-panic/](https://arwyn6969.github.io/dont-panic/)

## How to play

1. Click the cover (or wait a second) to start.
2. Type commands, or tap the verb keys, compass, hints, and nouns.
3. **Don't Panic mode** (on by default) shows context hints and can yank you back from death via autosave.
4. Save / Restore uses three local slots plus an autosave. Progress lives in this browser only.

## Stack

- Infocom `s4.z3` story file (embedded as `story-data.js`)
- [ifvms](https://github.com/curiousdannii/ifvms.js) ZVM interpreter
- Custom MiniGlk shim + Guide chrome (`guide-ui.js`, `guide.css`)

No server. No account. Open `index.html` locally or via GitHub Pages.

## Disclaimer

This is a private-use / friends project. The original Infocom story text and design belong to their rights holders (historically Infocom / Activision; Adams estate for the underlying work). Do not treat this repo as a licensed redistribution. If this ever ships commercially, get a license first.

Official places to play the original include releases sold by the current rights holder and the BBC / douglasadams.com presentations of the material.
