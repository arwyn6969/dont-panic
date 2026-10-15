(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const AUTO = "hhg-slot-auto";
  const EASY_KEY = "hhg-easy";
  const D = window.GuideData || {};
  const ART = D.ART || {};
  const ROOM_KEYS = D.ROOM_KEYS || [];
  const SCENE_HINTS = D.SCENE_HINTS || {};
  const NOUNS = D.NOUNS || [];
  const TOPICS = D.TOPICS || {};
  const DEATH_RE = D.DEATH_RE || /\byou have died\b|\byou are dead\b|better luck next life|\byou black out\b/i;
  const state = {
    easy: localStorage.getItem(EASY_KEY) !== "0",
    lastArt: "", ready: false, history: [], histIdx: -1, fileMode: null, dead: false,
    room: "", roomKey: "dont-panic", turns: 0, score: 0, preTurn: null,
    hasGuide: false, items: new Set(), lastTurn: "", lastCommand: "", guideOpen: false
  };

  function toast(msg) {
    const el = $("#toast"); if (!el) return;
    el.textContent = msg; el.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("show"), 2400);
  }
  function wordHas(hay, needle) {
    const safe = String(needle).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    return new RegExp("(?:^|[^a-z0-9])" + safe + "(?:$|[^a-z0-9])", "i").test(hay);
  }
  function plate(key) {
    const spec = ART[key] || ART["dont-panic"] || { cap: key, hue: 8 };
    const c = document.createElement("canvas"); c.width = 960; c.height = 600;
    const g = c.getContext("2d"); const hue = spec.hue || 8;
    g.fillStyle = "#050505"; g.fillRect(0, 0, 960, 600);
    g.strokeStyle = "hsl(" + hue + ",28%,38%)"; g.strokeRect(28, 28, 904, 544);
    g.fillStyle = "#ff3b14"; g.font = "700 54px Anton, Impact, sans-serif"; g.fillText("DON'T PANIC", 56, 120);
    g.fillStyle = "#b6e2a8"; g.font = "18px monospace"; g.fillText(String(spec.cap || key).toUpperCase(), 56, 168);
    g.fillStyle = "#7a7a6a"; g.font = "13px monospace"; g.fillText("LOCATION PLATE / " + key.toUpperCase(), 56, 540);
    return c.toDataURL("image/png");
  }
  const plateCache = {};
  function artSrc(key) {
    const OV = window.ART_OVERRIDES || {};
    if (OV[key]) return OV[key];
    if (window.ART_DATA && window.ART_DATA[key]) return window.ART_DATA[key];
    const spec = ART[key];
    if (spec && spec.file) return "art/" + spec.file + ".jpg";
    return plateCache[key] || (plateCache[key] = plate(key));
  }
  function setArt(key) {
    if (!ART[key]) key = "dont-panic";
    if (state.lastArt === key) return;
    state.lastArt = key;
    document.body.dataset.room = key;
    const img = $("#art"), cap = $("#artCap"), spec = ART[key];
    if (img) img.classList.add("dim");
    setTimeout(() => {
      if (img) {
        img.onerror = () => { img.src = plateCache[key] || (plateCache[key] = plate(key)); };
        img.src = artSrc(key);
        img.classList.remove("dim");
      }
      if (cap && spec) cap.textContent = spec.cap;
      renderHotspots(key);
    }, 140);
  }
  function statusText() { return ($("#statusline") && $("#statusline").textContent) || ""; }
  function parseStatus(text) {
    const raw = String(text || "").replace(/\s+/g, " ").trim();
    const sm = raw.match(/Score:\s*(-?\d+)/i); const tm = raw.match(/Turns:\s*(-?\d+)/i);
    if (sm) state.score = Number(sm[1]); if (tm) state.turns = Number(tm[1]);
    state.room = raw.replace(/·\s*Score:.*$/i, "").replace(/Score:.*$/i, "").trim();
    return state.room;
  }
  function roomKeyFrom(room, turn) {
    const blob = room + "\n" + turn;
    for (const row of ROOM_KEYS) if (row.test.test(room) || row.test.test(blob)) return row.key;
    return state.roomKey || "bedroom";
  }
  function parseItems(turn) {
    const text = String(turn || "");
    const block = text.match(/You have:([\s\S]{0,400})/i);
    if (block) {
      const next = new Set();
      block[1].split(/\n/).forEach((line) => {
        const cleaned = line.replace(/^[ \t>\-]+/, "").replace(/\.$/, "").trim().toLowerCase();
        if (!cleaned || /splitting headache|no tea|^you /.test(cleaned)) return;
        next.add(cleaned.replace(/^an? |^the |^your /, ""));
        if (/gown/.test(cleaned)) next.add("gown");
        if (/guide/.test(cleaned)) state.hasGuide = true;
      });
      if (next.size) state.items = next;
    }
    const took = (state.lastCommand || "").match(/^(?:get|take|pick up)\s+(?:the |an? |your )?(.+)$/i);
    if (took && !/\b(can'?t|cannot|don't|already)\b/i.test(text)) state.items.add(took[1].trim().toLowerCase());
    const wore = (state.lastCommand || "").match(/^wear\s+(?:the |an? |your )?(.+)$/i);
    if (wore && !/\b(can'?t|cannot)\b/i.test(text)) state.items.add(wore[1].trim().toLowerCase() + " (being worn)");
  }
  function isShip(key) { return key === "hog" || key === "vogon" || key === "poetry"; }
  function setCompass(key) {
    const ship = isShip(key);
    const map = ship ? { north: "fore", south: "aft", east: "starboard", west: "port" }
      : { north: "north", south: "south", east: "east", west: "west" };
    $$(".compass [data-dir]").forEach((btn) => {
      const cmd = map[btn.getAttribute("data-dir")] || btn.getAttribute("data-dir");
      btn.setAttribute("data-cmd", cmd);
      btn.textContent = cmd === "starboard" ? "STBD" : cmd.toUpperCase();
    });
  }
  function scanWorld(turnText) {
    const turn = typeof turnText === "string" ? turnText : (window.MiniGlk && MiniGlk.turnBuffer) || state.lastTurn || "";
    state.lastTurn = turn;
    const key = roomKeyFrom(parseStatus(statusText()), turn);
    state.roomKey = key;
    parseItems(turn);
    setArt(key); setCompass(key); renderHints(); renderNouns(); renderHotspots(key);
    $("#guideBtn") && $("#guideBtn").classList.toggle("has-book", state.hasGuide);
    document.body.dataset.ship = isShip(key) ? "1" : "0";
  }
  function renderHints() {
    const box = $("#hints"), notice = $("#notice");
    if (!box) return;
    box.innerHTML = "";
    if (!state.easy) { box.style.display = "none"; if (notice) notice.style.display = "none"; return; }
    box.style.display = "flex";
    const scene = SCENE_HINTS[state.roomKey];
    if (notice) { notice.style.display = "block"; notice.textContent = (scene && scene.notice) || "Look. Inventory. Wait."; }
    const ctx = {
      turn: state.lastTurn || "", room: state.room || "",
      dark: /pitch black|can't see|cannot see/i.test(state.lastTurn),
      inBed: /in the bed/i.test(state.room + state.lastTurn),
      wearingGown: /wearing/.test([...state.items].join(" ")),
      has: (name) => [...state.items].some((i) => i.includes(name))
    };
    const cmds = scene && scene.cmds ? scene.cmds(ctx) : ["look", "inventory", "wait"];
    const seen = new Set();
    cmds.filter(Boolean).forEach((cmd) => {
      if (seen.has(cmd) || seen.size >= 4) return;
      seen.add(cmd);
      const b = document.createElement("button");
      b.className = "key"; b.type = "button"; b.textContent = cmd;
      b.addEventListener("click", () => submit(cmd));
      box.appendChild(b);
    });
  }
  function renderNouns() {
    const box = $("#nouns"); if (!box) return;
    box.innerHTML = "";
    const hay = (state.room + "\n" + state.lastTurn).toLowerCase();
    const seen = new Set();
    // Things in the room
    NOUNS.filter((n) => wordHas(hay, n)).slice(0, 8).forEach((n) => {
      if (seen.has(n)) return; seen.add(n);
      const b = document.createElement("button");
      b.className = "topic noun"; b.type = "button"; b.textContent = n;
      b.title = "click: examine · right-click: get";
      b.addEventListener("click", () => submit("examine " + n));
      b.addEventListener("contextmenu", (e) => { e.preventDefault(); submit("get " + n); });
      box.appendChild(b);
    });
    // Things you're carrying
    [...state.items].slice(0, 6).forEach((item) => {
      const name = item.replace(/ \(being worn\)$/, "");
      if (seen.has(name) || name.length < 2) return;
      seen.add(name);
      const b = document.createElement("button");
      b.className = "topic noun carried"; b.type = "button";
      b.textContent = name + (item.includes("worn") ? " *" : "");
      b.title = "carried · click: examine · right-click: drop";
      b.addEventListener("click", () => submit("examine " + name));
      b.addEventListener("contextmenu", (e) => { e.preventDefault(); submit("drop " + name); });
      box.appendChild(b);
    });
    const strip = $("#plateActions");
    if (strip) {
      strip.innerHTML = "";
      const quick = [];
      if (state.roomKey === "bedroom") {
        if (!state.items.has("gown") && !state.items.has("dressing gown")) quick.push(["get gown", "gown"]);
        if (![...state.items].some(i => /gown/.test(i) && /worn/.test(i))) quick.push(["wear gown", "wear"]);
        if (!state.items.has("screwdriver")) quick.push(["get screwdriver", "screwdriver"]);
        if (!state.items.has("toothbrush")) quick.push(["get toothbrush", "toothbrush"]);
      }
      NOUNS.filter((n) => wordHas(hay, n)).slice(0, 4).forEach((n) => quick.push(["examine " + n, n]));
      quick.slice(0, 5).forEach(([cmd, label]) => {
        const a = document.createElement("button");
        a.className = "plate-act"; a.type = "button"; a.textContent = label;
        a.title = cmd;
        a.addEventListener("click", () => submit(cmd));
        strip.appendChild(a);
      });
    }
  }
  const HOTSPOTS = {
    bedroom: [
      { x: 6, y: 26, w: 30, h: 36, cmd: "examine bed", get: "get up", label: "bed" },
      { x: 30, y: 28, w: 16, h: 20, cmd: "examine lamp", label: "lamp" },
      { x: 46, y: 24, w: 16, h: 20, cmd: "examine washbasin", label: "basin" },
      { x: 68, y: 14, w: 22, h: 34, cmd: "examine window", label: "window" },
      { x: 58, y: 40, w: 16, h: 28, cmd: "examine gown", get: "get gown", label: "gown" },
      { x: 32, y: 58, w: 16, h: 16, cmd: "examine phone", label: "phone" },
      { x: 46, y: 64, w: 12, h: 12, cmd: "get screwdriver", label: "screwdriver" },
      { x: 56, y: 64, w: 12, h: 12, cmd: "get toothbrush", label: "toothbrush" }
    ],
    house: [
      { x: 14, y: 36, w: 14, h: 36, cmd: "examine prosser", label: "prosser" },
      { x: 30, y: 20, w: 26, h: 42, cmd: "examine house", label: "house" },
      { x: 28, y: 60, w: 28, h: 18, cmd: "lie down", label: "lie down" },
      { x: 52, y: 34, w: 34, h: 38, cmd: "examine bulldozer", label: "bulldozer" }
    ],
    pub: [
      { x: 16, y: 26, w: 26, h: 36, cmd: "examine bar", label: "bar" },
      { x: 40, y: 30, w: 16, h: 40, cmd: "examine arthur", label: "arthur" },
      { x: 54, y: 28, w: 16, h: 40, cmd: "examine ford", label: "ford" },
      { x: 26, y: 50, w: 12, h: 12, cmd: "eat peanuts", label: "peanuts" },
      { x: 36, y: 50, w: 10, h: 10, cmd: "drink beer", label: "beer" },
      { x: 58, y: 42, w: 10, h: 14, cmd: "examine satchel", label: "satchel" }
    ],
    vogon: [
      { x: 6, y: 30, w: 24, h: 40, cmd: "examine dispenser", label: "dispenser" },
      { x: 36, y: 8, w: 16, h: 32, cmd: "examine hook", label: "hook" },
      { x: 56, y: 56, w: 16, h: 16, cmd: "examine drain", label: "drain" },
      { x: 76, y: 26, w: 18, h: 38, cmd: "examine panel", label: "panel" },
      { x: 18, y: 42, w: 10, h: 12, cmd: "press button", label: "button" }
    ],
    hog: [
      { x: 26, y: 26, w: 22, h: 36, cmd: "examine drive", label: "drive" },
      { x: 58, y: 30, w: 20, h: 28, cmd: "examine eddie", label: "eddie" },
      { x: 8, y: 36, w: 16, h: 22, cmd: "examine console", label: "console" },
      { x: 42, y: 48, w: 14, h: 12, cmd: "examine panel", label: "panel" }
    ],
    poetry: [
      { x: 30, y: 26, w: 28, h: 38, cmd: "examine captain", label: "captain" },
      { x: 38, y: 40, w: 14, h: 14, cmd: "listen", label: "poetry" },
      { x: 22, y: 28, w: 10, h: 28, cmd: "examine door", label: "door" }
    ],
    lane: [
      { x: 62, y: 18, w: 22, h: 28, cmd: "examine pub", label: "pub" },
      { x: 38, y: 32, w: 24, h: 36, cmd: "examine lane", label: "lane" },
      { x: 10, y: 28, w: 18, h: 32, cmd: "examine hedge", label: "hedge" }
    ],
    magrathea: [
      { x: 32, y: 28, w: 36, h: 36, cmd: "examine fjord", label: "fjord" },
      { x: 42, y: 48, w: 16, h: 20, cmd: "examine planet", label: "planet" }
    ],
    galley: [
      { x: 38, y: 22, w: 28, h: 42, cmd: "examine nutri-matic", label: "nutri-matic" },
      { x: 46, y: 36, w: 12, h: 14, cmd: "examine tea", label: "tea" }
    ],
    dark: [
      { x: 28, y: 22, w: 44, h: 40, cmd: "listen", label: "listen" },
      { x: 30, y: 64, w: 20, h: 12, cmd: "feel", label: "feel" },
      { x: 52, y: 64, w: 20, h: 12, cmd: "smell", label: "smell" }
    ],
    space: [
      { x: 32, y: 24, w: 36, h: 36, cmd: "examine hatch", label: "hatch" },
      { x: 10, y: 32, w: 18, h: 20, cmd: "examine ship", label: "ship" },
      { x: 70, y: 28, w: 16, h: 18, cmd: "look", label: "look" }
    ],
    whale: [
      { x: 22, y: 20, w: 36, h: 32, cmd: "examine whale", label: "whale" },
      { x: 40, y: 52, w: 22, h: 20, cmd: "examine petunias", label: "petunias" },
      { x: 68, y: 22, w: 18, h: 18, cmd: "examine drive", label: "drive" }
    ],
    earth: [
      { x: 28, y: 18, w: 36, h: 40, cmd: "examine earth", label: "earth" },
      { x: 68, y: 16, w: 22, h: 18, cmd: "examine bypass", label: "bypass" }
    ]
  };
  function imageBounds() {
    const img = $("#art"), wrap = img && img.parentElement;
    if (!img || !wrap) return null;
    const wr = wrap.getBoundingClientRect();
    const nw = img.naturalWidth || 960, nh = img.naturalHeight || 600;
    if (!nw || !nh || !wr.width || !wr.height) return { left: 0, top: 0, width: wr.width, height: wr.height };
    const scale = Math.min(wr.width / nw, wr.height / nh);
    const w = nw * scale, h = nh * scale;
    return { left: (wr.width - w) / 2, top: (wr.height - h) / 2, width: w, height: h };
  }
  function renderHotspots(key) {
    const box = $("#hotspots"); if (!box) return;
    box.innerHTML = "";
    const spots = HOTSPOTS[key] || [];
    const b = imageBounds();
    if (!b) return;
    box.style.left = b.left + "px";
    box.style.top = b.top + "px";
    box.style.width = b.width + "px";
    box.style.height = b.height + "px";
    spots.forEach((s) => {
      const btn = document.createElement("button");
      btn.className = "hotspot";
      btn.type = "button";
      btn.title = s.label || s.cmd;
      btn.dataset.label = s.label || s.cmd;
      btn.style.left = s.x + "%";
      btn.style.top = s.y + "%";
      btn.style.width = s.w + "%";
      btn.style.height = s.h + "%";
      btn.addEventListener("click", (e) => { e.stopPropagation(); submit(s.cmd); });
      if (s.get) btn.addEventListener("contextmenu", (e) => { e.preventDefault(); submit(s.get); });
      box.appendChild(btn);
    });
  }
  function packSlot(b64, safe) {
    return JSON.stringify({ v: 1, data: b64, room: state.room, roomKey: state.roomKey, turns: state.turns, score: state.score, at: Date.now(), safe: !!safe });
  }
  function unpackSlot(raw) {
    if (!raw) return null;
    if (raw.charAt(0) === "{") { try { return JSON.parse(raw); } catch (e) {} }
    return { v: 0, data: raw };
  }
  function slotLabel(key) {
    try {
      const rec = unpackSlot(localStorage.getItem(key));
      if (!rec || !rec.data) return "empty";
      return [rec.room || "saved", rec.turns != null ? "t" + rec.turns : ""].filter(Boolean).join(" · ");
    } catch (e) { return "empty"; }
  }
  function refreshSlots() {
    $$("[data-slot]").forEach((btn) => {
      const mark = btn.querySelector("em");
      if (mark) mark.textContent = slotLabel(btn.getAttribute("data-slot"));
    });
  }
  function openSlots(mode) {
    state.fileMode = mode;
    $("#slotTitle").textContent = /save/.test(mode) ? "Save to a slot" : "Restore a slot";
    $("#slotmodal").classList.add("show"); refreshSlots();
  }
  function closeSlots() {
    $("#slotmodal").classList.remove("show");
    if (/prompt-/.test(state.fileMode || "")) MiniGlk.cancelFilePrompt();
    state.fileMode = null;
  }
  function loadPacked(raw, okMsg) {
    const rec = unpackSlot(raw);
    if (!(rec && rec.data)) { toast("Empty slot."); return false; }
    const ok = MiniGlk.restoreSnapshot(rec.data);
    toast(ok ? (okMsg || "Restored.") : "Restore failed.");
    if (ok) {
      state.dead = false; $("#deadpane").classList.remove("show");
      MiniGlk._write(MiniGlk.current, "\n[The universe hiccups back into a previous shape.]\n", "cmd");
      submit("look");
    }
    return ok;
  }
  function useSlot(key) {
    const mode = state.fileMode; $("#slotmodal").classList.remove("show");
    if (mode === "prompt-save" || mode === "prompt-restore") {
      const rec = unpackSlot(localStorage.getItem(key));
      if (mode === "prompt-restore" && !(rec && rec.data)) { toast("That slot is empty."); MiniGlk.cancelFilePrompt(); state.fileMode = null; return; }
      MiniGlk.finishFilePrompt(key, rec && rec.data);
      toast(mode === "prompt-save" ? "Saved." : "Restored.");
      state.fileMode = null; state.dead = false; $("#deadpane").classList.remove("show");
      return;
    }
    if (mode === "save") {
      const snap = MiniGlk.snapshot();
      if (!snap) { toast("Could not snapshot the universe."); return; }
      localStorage.setItem(key, packSlot(snap, true)); toast("Saved.");
    } else if (mode === "restore") loadPacked(localStorage.getItem(key), "Restored. Look around.");
    state.fileMode = null;
  }
  function autosave() {
    try { const snap = MiniGlk.snapshot(); if (snap) localStorage.setItem(AUTO, packSlot(snap, true)); } catch (e) {}
  }
  function afterTurn() {
    state.lastTurn = (window.MiniGlk && MiniGlk.turnBuffer) || "";
    state.lastCommand = (window.MiniGlk && MiniGlk.lastCommand) || "";
    const dead = DEATH_RE.test(state.lastTurn);
    if (dead && !state.dead) {
      state.dead = true;
      if (state.easy) {
        if (state.preTurn) try { localStorage.setItem(AUTO, packSlot(state.preTurn, true)); } catch (e) {}
        const q = $("#deadQuote"); if (q) q.textContent = state.lastTurn.replace(/\s+/g, " ").trim().slice(0, 240);
        $("#deadpane") && $("#deadpane").classList.add("show");
      }
    } else if (!dead) {
      state.dead = false; $("#deadpane") && $("#deadpane").classList.remove("show"); autosave();
    }
    scanWorld(state.lastTurn);
  }
  function submit(command) {
    const cmd = String(command || "").trim(); if (!cmd) return;
    $("#command").value = "";
    if (!state.ready || !window.MiniGlk) { toast("The Guide is still waking up."); return; }
    const low = cmd.toLowerCase();
    if (low === "restart") { location.reload(); return; }
    if (low === "save") { openSlots("save"); return; }
    if (low === "restore") { openSlots("restore"); return; }
    if (state.history[state.history.length - 1] !== cmd) state.history.push(cmd);
    state.histIdx = state.history.length;
    try { state.preTurn = MiniGlk.snapshot(); } catch (e) { state.preTurn = null; }
    MiniGlk.acceptLine(cmd);
  }
  function typeInto(command) {
    const field = $("#command"); const cur = field.value.trim();
    field.value = cur ? cur + " " + command : command; field.focus();
  }
  function setGuideOpen(open) {
    state.guideOpen = !!open;
    const panel = $("#guidePanel"); if (!panel) return;
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    panel.classList.toggle("open", open);
    $("#guideBtn") && $("#guideBtn").classList.toggle("on", open);
  }
  function showTopic(name) {
    const body = $("#guideEntry"); if (!body) return;
    const OV = window.ART_OVERRIDES || {};
    const map = {
      "babel fish": OV.babel,
      panic: OV.guide,
      towel: OV.towel,
      tea: OV.tea || OV.galley,
      marvin: OV.marvin,
      vogons: OV.vogon,
      "heart of gold": OV.hog,
      magrathea: OV.magrathea || OV.slarti,
      earth: OV.earth,
      improbability: OV.drive || OV.whale,
      hitchhiking: OV.thumb,
      dark: OV.dark,
      "ford prefect": OV.pub
    };
    const diagram = map[name] || null;
    const img = diagram ? '<img class="guide-diagram" src="' + diagram + '" alt="' + name + '">' : "";
    body.innerHTML = "<h3>" + name + "</h3>" + img + "<p>" + (TOPICS[name] || "The Guide has much to say, little of it helpful.") + "</p>";
    const ask = document.createElement("button");
    ask.className = "key"; ask.type = "button";
    ask.textContent = state.hasGuide ? "Ask the ship's Guide" : "The ship's Guide is not in this pocket";
    ask.disabled = !state.hasGuide;
    ask.addEventListener("click", () => {
      if (!state.hasGuide) { toast("You do not have the actual Guide yet."); return; }
      setGuideOpen(false); submit("consult guide about " + name);
    });
    body.appendChild(ask); setArt("guide");
  }
  function bindKeys() {
    $$("[data-cmd]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cmd = btn.getAttribute("data-cmd");
        const mode = btn.getAttribute("data-mode") || "send";
        if (cmd === "ANY") { submit(["look", "inventory", "wait", "enjoy life", "don't panic", "hello"][Math.floor(Math.random() * 6)]); return; }
        if (cmd === "save") { openSlots("save"); return; }
        if (cmd === "restore") { openSlots("restore"); return; }
        if (cmd === "consult guide about") { setGuideOpen(true); if (!state.hasGuide) toast("Chrome Guide only — you have not picked up the real one."); return; }
        if (mode === "insert") typeInto(cmd); else submit(cmd);
      });
    });
    const field = $("#command");
    field.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); submit(field.value); }
      else if (e.key === "ArrowUp") { e.preventDefault(); if (!state.history.length) return; state.histIdx = Math.max(0, state.histIdx - 1); field.value = state.history[state.histIdx]; }
      else if (e.key === "ArrowDown") { e.preventDefault(); state.histIdx = Math.min(state.history.length, state.histIdx + 1); field.value = state.history[state.histIdx] || ""; }
    });
    $("#go").addEventListener("click", () => submit(field.value));
    $("#easyBtn").addEventListener("click", () => {
      state.easy = !state.easy;
      try { localStorage.setItem(EASY_KEY, state.easy ? "1" : "0"); } catch (e) {}
      $("#easyBtn").classList.toggle("on", state.easy);
      $("#easyBtn").textContent = state.easy ? "Don't Panic mode" : "Classic parser";
      renderHints();
    });
    $("#easyBtn").classList.toggle("on", state.easy);
    $("#easyBtn").textContent = state.easy ? "Don't Panic mode" : "Classic parser";
    $("#guideBtn") && $("#guideBtn").addEventListener("click", () => setGuideOpen(!state.guideOpen));
    $("#guideClose") && $("#guideClose").addEventListener("click", () => setGuideOpen(false));
    Object.keys(TOPICS).forEach((topic) => {
      const b = document.createElement("button"); b.className = "topic"; b.type = "button"; b.textContent = topic;
      b.addEventListener("click", () => showTopic(topic)); $("#topics").appendChild(b);
    });
    $$("[data-slot]").forEach((btn) => btn.addEventListener("click", () => useSlot(btn.getAttribute("data-slot"))));
    $("#slotCancel").addEventListener("click", closeSlots);
    $("#deadRestore").addEventListener("click", () => loadPacked(localStorage.getItem(AUTO), "Yanked back from the wreckage."));
    $("#deadRestart").addEventListener("click", () => location.reload());
  }
  function patchGlk(Glk) {
    if (!Glk || Glk._guidePatch) return;
    Glk._guidePatch = true; Glk.turnBuffer = ""; Glk.lastTurn = ""; Glk.lastCommand = "";
    const write = Glk._write;
    Glk._write = function (win, text, kind) {
      if (!win) win = this.current;
      if (text && kind !== "cmd" && win && win.type !== 4 && win.rock !== 202) this.turnBuffer += text;
      return write.call(this, win, text, kind);
    };
    const accept = Glk.acceptLine;
    Glk.acceptLine = function (text) {
      this.lastCommand = String(text || ""); this.turnBuffer = "";
      const result = accept.call(this, text); this.lastTurn = this.turnBuffer; return result;
    };
  }
  async function loadStory() {
    if (window.STORY_Z3_B64) {
      const bin = atob(window.STORY_Z3_B64); const buf = new ArrayBuffer(bin.length); const view = new Uint8Array(buf);
      for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i); return buf;
    }
    const urls = window.STORY_FETCH_URLS || ["story/s4.z3"]; let lastErr = null;
    for (const url of urls) {
      try { const res = await fetch(url); if (res.ok) return await res.arrayBuffer(); lastErr = new Error("HTTP " + res.status + " " + url); }
      catch (e) { lastErr = e; }
    }
    throw lastErr || new Error("Could not load story file");
  }
  async function startMachine() {
    const buf = await loadStory();
    if (!window.ZVM) throw new Error("ZVM did not load from the CDN");
    const Glk = window.MiniGlk; patchGlk(Glk);
    const vm = new window.ZVM();
    Glk.attach($("#windowport"), $("#statusline")); Glk.vm = vm;
    Glk.onAfterTurn = afterTurn;
    Glk.onFilePrompt = (data) => openSlots((data && data.func) === "restore" ? "prompt-restore" : "prompt-save");
    vm.prepare(buf, { Glk: Glk }); vm.init();
    state.ready = true;
    Glk.lastTurn = Glk.turnBuffer || ""; state.lastTurn = Glk.lastTurn;
    scanWorld(state.lastTurn);
    setTimeout(() => { autosave(); $("#command") && $("#command").focus(); }, 400);
    window.addEventListener("resize", () => renderHotspots(state.roomKey));
    const artImg = $("#art");
    if (artImg) artImg.addEventListener("load", () => renderHotspots(state.roomKey));
  }
  window.addEventListener("load", async () => {
    bindKeys();
    const boot = $("#boot");
    const start = () => { boot.classList.add("hide"); setTimeout(() => boot.style.display = "none", 900); };
    if (boot) { boot.addEventListener("click", start); setTimeout(start, 1800); }
    const cover = artSrc("dont-panic");
    if ($("#art")) $("#art").src = cover;
    if ($("#bootImg")) { $("#bootImg").onerror = () => { $("#bootImg").src = plate("dont-panic"); }; $("#bootImg").src = cover; }
    state.lastArt = ""; setArt("dont-panic");
    try { await startMachine(); }
    catch (e) { console.error(e); toast("Could not start the story file."); if ($("#windowport")) $("#windowport").textContent = String(e && e.stack ? e.stack : e); }
  });
  window.GuideConsole = { submit, setArt, scanWorld, setGuideOpen, setGuide: showTopic, setHints: (cmds, notice) => { if (notice && $("#notice")) $("#notice").textContent = notice; renderHints(); }, state };
})();
