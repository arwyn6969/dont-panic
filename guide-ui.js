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
    setArt(key); setCompass(key); renderHints(); renderNouns();
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
    const hay = (state.room + "\n" + state.lastTurn + "\n" + [...state.items].join("\n")).toLowerCase();
    NOUNS.filter((n) => wordHas(hay, n)).slice(0, 10).forEach((n) => {
      const b = document.createElement("button");
      b.className = "topic noun"; b.type = "button"; b.textContent = n;
      b.addEventListener("click", () => {
        // One-click examine; second click or shift for get
        submit("examine " + n);
      });
      b.addEventListener("contextmenu", (e) => { e.preventDefault(); submit("get " + n); });
      box.appendChild(b);
    });
    // Make plate objects clickable by exposing a small action strip under the caption
    const strip = $("#plateActions");
    if (strip) {
      strip.innerHTML = "";
      NOUNS.filter((n) => wordHas(hay, n)).slice(0, 6).forEach((n) => {
        const a = document.createElement("button");
        a.className = "plate-act"; a.type = "button"; a.textContent = n;
        a.addEventListener("click", () => submit("examine " + n));
        strip.appendChild(a);
      });
    }
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
    const diagram = (name === "babel fish" && OV.babel) || (name === "panic" && OV.guide) || null;
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
