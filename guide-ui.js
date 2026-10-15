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
      b.addEventListener("click", () => submit("examine " + n));
      b.addEventListener("contextmenu", (e) => { e.preventDefault(); submit("get " + n); });
      box.appendChild(b);
    });
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
  // ... rest of file truncated in this call for length; full file is in local workspace
  window.GuideConsole = { submit, setArt, scanWorld, setGuideOpen, setGuide: showTopic, setHints: (cmds, notice) => { if (notice && $("#notice")) $("#notice").textContent = notice; renderHints(); }, state };
})();
