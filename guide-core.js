(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const AUTO = "hhg-slot-auto";
  const EASY_KEY = "hhg-easy";
  const state = {
    easy: (() => {
      try { return localStorage.getItem(EASY_KEY) !== "0"; } catch (e) { return true; }
    })(),
    guideOpen: false,
    ready: false,
    history: [],
    histIdx: -1,
    fileMode: null,
    dead: false,
    hasGuide: false,
    lastArt: "dont-panic"
  };

  const DATA = window.GuideData || {};
  const ROOM_KEYS = DATA.ROOM_KEYS || [];
  const SCENE_HINTS = DATA.SCENE_HINTS || {};
  const NOUNS = DATA.NOUNS || [];
  const TOPICS = DATA.TOPICS || {};
  const DEATH_RE = DATA.DEATH_RE || /you have died|you are dead|better luck next life|you black out/i;

  function toast(msg) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2400);
  }

  function plate(key) {
    const cap = (DATA.ART && DATA.ART[key] && DATA.ART[key].cap) || key;
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 600;
    const g = canvas.getContext("2d");
    g.fillStyle = "#050505";
    g.fillRect(0, 0, 960, 600);
    g.strokeStyle = "#6d9a62";
    g.strokeRect(28, 28, 904, 544);
    g.fillStyle = "#ff3b14";
    g.font = "700 54px Anton, Impact, sans-serif";
    g.fillText("DON'T PANIC", 56, 120);
    g.fillStyle = "#b6e2a8";
    g.font = "18px monospace";
    g.fillText(String(cap).toUpperCase(), 56, 168);
    return canvas.toDataURL("image/png");
  }

  function artSrc(key) {
    return (window.ART_DATA && window.ART_DATA[key]) || plate(key);
  }

  function setArt(key) {
    if (!key || !DATA.ART || !DATA.ART[key] || state.lastArt === key) return;
    state.lastArt = key;
    const img = $("#art");
    if (img) {
      img.classList.add("dim");
      setTimeout(() => {
        img.src = artSrc(key);
        const capEl = $("#artCap");
        if (capEl) capEl.textContent = DATA.ART[key].cap;
        img.classList.remove("dim");
      }, 120);
    }
  }

  function gameText() {
    const out = $("#windowport");
    return out ? out.innerText : "";
  }

  function statusText() {
    const line = $("#statusline");
    return line ? line.textContent : "";
  }

  function toNoticeText(tail) {
    const room = findRoomKey(tail);
    const scene = room && SCENE_HINTS[room] ? SCENE_HINTS[room].notice : "";
    return scene || "The Guide keeps its counsel until it is gently invited.";
  }

  function findRoomKey(tail) {
    if (!tail) return "dont-panic";
    for (const rule of ROOM_KEYS) {
      if (rule.test.test(tail)) return rule.key;
    }
    return "dont-panic";
  }

  function renderHints() {
    const box = $("#hints");
    if (!box) return;
    box.innerHTML = "";

    if (!state.easy) {
      box.style.display = "none";
      return;
    }

    box.style.display = "flex";
    const tail = (statusText() + "\n" + gameText()).slice(-1800);
    const room = findRoomKey(tail);
    const scene = SCENE_HINTS[room] || null;
    const seen = new Set();
    const add = (cmd) => {
      if (!cmd || seen.has(cmd)) return;
      seen.add(cmd);
      const b = document.createElement("button");
      b.className = "key";
      b.type = "button";
      b.textContent = cmd;
      b.addEventListener("click", () => submit(cmd));
      box.appendChild(b);
    };

    if (scene && typeof scene.cmds === "function") {
      scene.cmds({ turn: tail, has: (n) => new RegExp("\\b" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(tail), dark: /pitch black|dark/.test(tail), inBed: /in the bed|bed/.test(tail), wearingGown: /wearing gown|gown/.test(tail), hasGuide: state.hasGuide }).forEach(add);
    }

    ["look", "inventory", "wait"].forEach((cmd) => add(cmd));
    if (!state.hasGuide) add("consult guide about");
  }

  function renderNouns() {
    const box = $("#nouns");
    if (!box) return;
    box.innerHTML = "";
    const tail = (statusText() + "\n" + gameText()).slice(-1800).toLowerCase();
    NOUNS.filter((noun) => tail.includes(noun.toLowerCase())).slice(0, 10).forEach((noun) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "noun";
      b.textContent = noun;
      b.addEventListener("click", () => {
        const field = $("#command");
        if (field) {
          field.value = field.value ? `${field.value.trim()} ${noun}` : noun;
          field.focus();
        }
      });
      box.appendChild(b);
    });
  }

  function checkDeath(tail) {
    const dead = DEATH_RE.test(tail) || /\byou die\b/i.test(tail);
    const pane = $("#deadpane");
    if (dead && !state.dead && state.easy) {
      state.dead = true;
      const quoteEl = $("#deadQuote");
      if (quoteEl) {
        const quote = /\*\*\*[^\n]*\*\*\*/.test(tail)
          ? tail.match(/\*\*\*([^\n]*)\*\*\*/)?.[1]?.trim() || "No one ever said the Universe was fair."
          : "No one ever said the Universe was fair.";
        quoteEl.textContent = quote;
      }
      if (pane) pane.classList.add("show");
    }
    if (!dead && pane) pane.classList.remove("show");
    state.dead = !!dead;
  }

  function scanWorld() {
    const tail = (statusText() + "\n" + gameText()).slice(-1800);
    const room = findRoomKey(tail);
    setArt(room);
    const noticeEl = $("#notice");
    if (noticeEl) noticeEl.textContent = toNoticeText(tail);
    renderHints();
    renderNouns();
    checkDeath(tail);
    const guide = $("#guideEntry");
    if (guide && !guide.dataset.topic && state.hasGuide) {
      guide.innerHTML = "<h3>Entries</h3><p>The Guide is open. Ask a topic or examine the room.</p>";
    }
  }

  function setGuideOpen(open) {
    const panel = $("#guidePanel");
    if (!panel) return;
    state.guideOpen = !!open;
    panel.classList.toggle("open", !!open);
    panel.setAttribute("aria-hidden", String(!open));
    const btn = $("#guideBtn");
    if (btn) btn.classList.toggle("on", !!open);
  }

  function showTopic(name) {
    const body = $("#guideEntry");
    if (!body) return;
    const topic = TOPICS[name] || "The Guide has much to say, little of it helpful.";
    body.innerHTML = `<h3>${name}</h3><p>${topic}</p>`;
    body.dataset.topic = name;
    setArt("guide");
    setGuideOpen(true);
  }

  function closeSlots() {
    const modal = $("#slotmodal");
    if (modal) modal.classList.remove("show");
    state.fileMode = null;
  }

  function slotLabel(key) {
    try { return localStorage.getItem(key) ? "saved" : "empty"; }
    catch (e) { return "empty"; }
  }

  function refreshSlots() {
    $$("[data-slot]").forEach((btn) => {
      const mark = btn.querySelector("em");
      if (mark) mark.textContent = slotLabel(btn.getAttribute("data-slot"));
    });
    const auto = $("#autoMark");
    if (auto) auto.textContent = slotLabel(AUTO);
  }

  function openSlots(mode) {
    state.fileMode = mode;
    const title = $("#slotTitle");
    if (title) title.textContent = mode === "save" ? "Save to a slot" : "Restore a slot";
    const modal = $("#slotmodal");
    if (modal) modal.classList.add("show");
    refreshSlots();
  }

  function useSlot(key) {
    const mode = state.fileMode;
    const modal = $("#slotmodal");
    if (modal) modal.classList.remove("show");

    if (mode === "save") {
      const snap = window.MiniGlk && window.MiniGlk.snapshot ? window.MiniGlk.snapshot() : null;
      if (!snap) {
        toast("Could not snapshot the universe.");
        state.fileMode = null;
        return;
      }
      try {
        localStorage.setItem(key, snap);
        toast("Saved.");
      } catch (e) {
        toast("Save failed.");
      }
      state.fileMode = null;
      return;
    }

    if (mode === "restore") {
      const raw = localStorage.getItem(key);
      if (!raw) {
        toast("Empty slot.");
        state.fileMode = null;
        return;
      }
      const ok = window.MiniGlk && window.MiniGlk.restoreSnapshot ? window.MiniGlk.restoreSnapshot(raw) : false;
      toast(ok ? "Restored." : "Restore failed.");
      if (ok) {
        const delay = window.setTimeout(() => {
          state.dead = false;
          const deadPane = $("#deadpane");
          if (deadPane) deadPane.classList.remove("show");
          submit("look");
          window.clearTimeout(delay);
        }, 60);
      }
      state.fileMode = null;
      return;
    }

    state.fileMode = null;
  }

  async function loadPacked(raw, label) {
    if (!raw) {
      toast("No autosave yet.");
      return false;
    }
    const ok = window.MiniGlk && window.MiniGlk.restoreSnapshot ? window.MiniGlk.restoreSnapshot(raw) : false;
    toast(ok ? label || "Restored." : "Restore failed.");
    if (ok) {
      state.dead = false;
      const pane = $("#deadpane");
      if (pane) pane.classList.remove("show");
      submit("look");
    }
    return ok;
  }

  function submit(command) {
    const cmd = String(command || "").trim();
    if (!cmd) return;
    const field = $("#command");
    if (field) field.value = "";
    if (!state.ready || !window.MiniGlk) {
      toast("The Guide is still waking up.");
      return;
    }
    const low = cmd.toLowerCase();
    if (low === "restart") { location.reload(); return; }
    if (low === "save") { openSlots("save"); return; }
    if (low === "restore") { openSlots("restore"); return; }
    if (state.history[state.history.length - 1] !== cmd) state.history.push(cmd);
    state.histIdx = state.history.length;
    window.MiniGlk.acceptLine(cmd);
    setTimeout(scanWorld, 40);
  }

  function typeInto(command) {
    const field = $("#command");
    if (!field) return;
    const cur = field.value.trim();
    field.value = cur ? `${cur} ${command}` : command;
    field.focus();
  }

  async function loadStory() {
    if (window.STORY_Z3_B64) {
      const bin = atob(window.STORY_Z3_B64);
      const buf = new ArrayBuffer(bin.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
      return buf;
    }
    const urls = window.STORY_FETCH_URLS || ["story/s4.z3"];
    let lastErr = null;
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) return await res.arrayBuffer();
        lastErr = new Error(`${res.status} ${url}`);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Could not load story file.");
  }

  async function startMachine() {
    const buf = await loadStory();
    if (!window.ZVM) throw new Error("ZVM did not load from the CDN");
    const vm = new window.ZVM();
    const glk = window.MiniGlk;
    glk.attach($("#windowport"), $("#statusline"));
    glk.vm = vm;
    glk.onPrint = () => scanWorld();
    glk.onAfterTurn = () => scanWorld();
    glk.onFilePrompt = (data) => {
      if (!data) return;
      const mode = state.fileMode === "restore" ? "restore" : "save";
      openSlots(mode);
    };
    vm.preload(buf, { Glk: glk });
    vm.init();
    state.ready = true;
    scanWorld();
    setTimeout(() => {
      const auto = localStorage.getItem(AUTO);
      if (auto && !state.dead) {
        toast("Autosave recovered.");
      }
    }, 100);
    return vm;
  }

  window.addEventListener("load", async () => {
    const boot = $("#boot");
    if (boot) {
      const start = () => {
        boot.classList.add("hide");
        setTimeout(() => { boot.style.display = "none"; }, 900);
      };
      boot.addEventListener("click", start);
      setTimeout(start, 1800);
    }
    const cover = artSrc("dont-panic");
    const art = $("#art");
    if (art) art.src = cover;
    const bootImg = $("#bootImg");
    if (bootImg) {
      bootImg.onerror = () => { bootImg.src = plate("dont-panic"); };
      bootImg.src = cover;
    }
    setArt("dont-panic");
    try {
      await startMachine();
    } catch (e) {
      console.error(e);
      toast("Could not start the story file.");
      const port = $("#windowport");
      if (port) port.textContent = String(e && e.stack ? e.stack : e);
    }
  });

  window._GuideCore = {
    toast,
    submit,
    typeInto,
    setGuideOpen,
    showTopic,
    openSlots,
    useSlot,
    closeSlots,
    loadPacked,
    startMachine,
    state,
    artSrc,
    plate,
    setArt,
    renderHints,
    scanWorld,
    refreshSlots,
    slotLabel,
  };

  window.GuideConsole = {
    submit,
    setArt,
    scanWorld,
    setGuideOpen,
    setGuide: showTopic,
  };
})();
