(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const C = window._GuideCore;
  const TOPICS = (window.GuideData && window.GuideData.TOPICS) || {};
  const AUTO = "hhg-slot-auto";
  const EASY_KEY = "hhg-easy";
  const { toast, submit, typeInto, setGuideOpen, showTopic, openSlots, useSlot, closeSlots, loadPacked, startMachine, state, artSrc, plate, setArt, renderHints, scanWorld } = C;
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
