(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const AUTO = "hhg-slot-auto";
  const state = { easy: true, lastArt: "dont-panic", ready: false, history: [], histIdx: -1, fileMode: null, dead: false };
  const ART = {
    "dont-panic": { cap: "COVER / DON'T PANIC" }, bedroom: { cap: "LOCAL / BEDROOM / EARTH" },
    house: { cap: "LOCAL / FRONT OF HOUSE" }, lane: { cap: "LOCAL / COUNTRY LANE" },
    pub: { cap: "LOCAL / PUB / PEANUTS AND BEER" }, earth: { cap: "PLANET / EARTH / MOSTLY HARMLESS" },
    space: { cap: "DEEP SPACE / IN TRANSIT" }, vogon: { cap: "VOGON CONSTRUCTOR FLEET" },
    hog: { cap: "STARSHIP / HEART OF GOLD" }, magrathea: { cap: "PLANET / MAGRATHEA" },
    guide: { cap: "DEVICE / THE GUIDE" }
  };
  const ART_RULES = [
    { key: "magrathea", test: /magrathea|slartibartfast|factory fjord|custom planet|matter look-up/i },
    { key: "hog", test: /heart of gold|improbability|nutri-matic|nutrimatic|\bmarvin\b|\beddie\b|sauna/i },
    { key: "vogon", test: /vogon|babel fish|poetry appreciation|captain's|hold of/i },
    { key: "pub", test: /\bpub\b|beer|peanuts|barman|six pints/i },
    { key: "lane", test: /country lane|lane\b|ford prefect is here/i },
    { key: "house", test: /bulldozer|prosser|front of (your |the )?house|rubble|bypass|front porch/i },
    { key: "earth", test: /planet earth|mostly harmless|destruction of earth/i },
    { key: "space", test: /darkness of space|airlock|whale|petunia|hyperspace/i },
    { key: "bedroom", test: /pitch black|bedroom|hangover|dressing gown|in the bed/i },
    { key: "guide", test: /hitchhiker's guide|consulted the guide/i }
  ];
  const HINTS = [
    { test: /pitch black|it is pitch black/i, cmds: ["turn on light", "get up"] },
    { test: /hangover|headache|in the bed/i, cmds: ["get gown", "examine gown", "take aspirin", "get screwdriver", "get toothbrush"] },
    { test: /dressing gown|pockets/i, cmds: ["examine gown", "look in pocket", "wear gown"] },
    { test: /bulldozer|prosser|front of/i, cmds: ["lie down", "wait", "examine bulldozer", "south"] },
    { test: /\bpub\b|beer|peanuts/i, cmds: ["buy sandwich", "drink beer", "wait", "eat peanuts"] },
    { test: /electronic thumb|sub-etha|yellow ship/i, cmds: ["examine thumb", "press thumb", "wait"] },
    { test: /vogon|hold/i, cmds: ["look", "inventory", "consult guide about babel fish", "wait"] },
    { test: /babel fish|dispenser/i, cmds: ["press dispenser button", "examine dispenser", "examine panel"] },
    { test: /heart of gold|improbability/i, cmds: ["look", "consult guide about tea", "south", "port"] },
    { test: /tea|nutri-matic|nutrimatic/i, cmds: ["examine machine", "get tea"] },
    { test: /marvin|corridor/i, cmds: ["talk to marvin", "south", "look"] }
  ];
  const NOUNS = ["gown","dressing gown","pocket","screwdriver","toothbrush","tablet","aspirin","phone","bed","curtain","window","light","bulldozer","prosser","ford","towel","satchel","thumb","sandwich","beer","peanuts","babel fish","dispenser","panel","hook","mail","fluff","tea","cup","machine","keypad","marvin","guide","sachet","junk mail"];
  const TOPICS = {
    earth: "Mostly harmless. Officially. The entry used to be longer, but after the editors saw the place they cut it for space.",
    vogons: "Bureaucrats with poetry. Do not allow either to happen to you if you can possibly help it.",
    "babel fish": "A living translator. Getting one out of a Vogon dispenser is a small engineering problem and a large joke at your expense.",
    towel: "The most massively useful thing a hitchhiker can have. Also useful for lying in front of things that want to drive over you.",
    tea: "Almost, but not quite, entirely unlike the liquid produced by the Nutri-Matic.",
    improbability: "A drive that works by becoming infinitely improbable. Side effects include whales, petunias, and identity trouble.",
    marvin: "A robot with the brain the size of a planet and the mood of a wet Wednesday in February.",
    magrathea: "A luxury planet factory that has been closed for business. Closed is a relative term.",
    "ford prefect": "Not from Guildford. Do what he says, eventually.",
    hitchhiking: "Stick out your thumb. Have a towel. Don't panic.",
    panic: "The cover is printed in large friendly letters for a reason."
  };
  function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove("show"),2400);}
  function plate(key){const cap=(ART[key]&&ART[key].cap)||key;const c=document.createElement("canvas");c.width=960;c.height=600;const g=c.getContext("2d");g.fillStyle="#050505";g.fillRect(0,0,960,600);g.strokeStyle="#6d9a62";g.strokeRect(28,28,904,544);g.fillStyle="#ff3b14";g.font="700 54px Anton, Impact, sans-serif";g.fillText("DON'T PANIC",56,120);g.fillStyle="#b6e2a8";g.font="18px monospace";g.fillText(String(cap).toUpperCase(),56,168);return c.toDataURL("image/png");}
  function artSrc(key){return (window.ART_DATA&&window.ART_DATA[key])||plate(key);}
  function setArt(key){if(!ART[key]||state.lastArt===key)return;state.lastArt=key;const img=$("#art");img.classList.add("dim");setTimeout(()=>{img.src=artSrc(key);$("#artCap").textContent=ART[key].cap;img.classList.remove("dim");},160);}
  function gameText(){return ($("#windowport")&&$("#windowport").innerText)||"";}
  function statusText(){return ($("#statusline")&&$("#statusline").textContent)||"";}
  function scanWorld(){const tail=(statusText()+"\n"+gameText()).slice(-1800);for(const rule of ART_RULES){if(rule.test.test(tail)){setArt(rule.key);break;}}renderHints(tail);renderNouns(tail);checkDeath(tail);}
  function renderHints(tail){const box=$("#hints");box.innerHTML="";if(!state.easy){box.style.display="none";return;}box.style.display="flex";const seen=new Set();const add=(cmd)=>{if(seen.has(cmd))return;seen.add(cmd);const b=document.createElement("button");b.className="key";b.textContent=cmd;b.addEventListener("click",()=>submit(cmd));box.appendChild(b);};for(const h of HINTS)if(h.test.test(tail))h.cmds.forEach(add);if(!seen.size)["look","inventory","wait"].forEach(add);}
  function renderNouns(tail){const box=$("#nouns");if(!box)return;box.innerHTML="";const low=tail.toLowerCase();NOUNS.filter(n=>low.includes(n)).slice(0,10).forEach(n=>{const b=document.createElement("button");b.className="topic noun";b.textContent=n;b.addEventListener("click",()=>{const field=$("#command");const cur=field.value.trim();field.value=cur?cur+" "+n:"examine "+n;field.focus();});box.appendChild(b);});}
  function checkDeath(tail){const dead=/you are dead|you have died|better luck next life|you black out|\*\*\* you have died/i.test(tail)||/\byou die\b/i.test(tail);const pane=$("#deadpane");if(dead&&!state.dead&&state.easy){state.dead=true;if(pane)pane.classList.add("show");}if(!dead){state.dead=false;if(pane)pane.classList.remove("show");}}
  function slotLabel(key){try{return localStorage.getItem(key)?"saved":"empty";}catch(e){return "empty";}}
  function refreshSlots(){$$("[data-slot]").forEach(btn=>{const mark=btn.querySelector("em");if(mark)mark.textContent=slotLabel(btn.getAttribute("data-slot"));});const auto=$("#autoMark");if(auto)auto.textContent=slotLabel(AUTO);}
  function openSlots(mode){state.fileMode=mode;$("#slotTitle").textContent=mode==="save"?"Save to a slot":"Restore a slot";$("#slotmodal").classList.add("show");refreshSlots();}
  function closeSlots(){$("#slotmodal").classList.remove("show");if(state.fileMode==="prompt-save"||state.fileMode==="prompt-restore")MiniGlk.cancelFilePrompt();state.fileMode=null;}
  function useSlot(key){const mode=state.fileMode;$("#slotmodal").classList.remove("show");if(mode==="prompt-save"||mode==="prompt-restore"){const existing=mode==="prompt-restore"?localStorage.getItem(key):null;if(mode==="prompt-restore"&&!existing){toast("That slot is empty.");MiniGlk.cancelFilePrompt();state.fileMode=null;return;}MiniGlk.finishFilePrompt(key,existing);toast(mode==="prompt-save"?"Saved.":"Restored.");state.fileMode=null;state.dead=false;$("#deadpane").classList.remove("show");return;}if(mode==="save"){const snap=MiniGlk.snapshot();if(!snap){toast("Could not snapshot the universe.");return;}localStorage.setItem(key,snap);toast("Saved.");}else if(mode==="restore"){const raw=localStorage.getItem(key);if(!raw){toast("Empty slot.");return;}const ok=MiniGlk.restoreSnapshot(raw);toast(ok?"Restored. Look around.":"Restore failed.");if(ok){MiniGlk._write(MiniGlk.current,"\n[The universe hiccups back into a previous shape.]\n>","cmd");state.dead=false;$("#deadpane").classList.remove("show");submit("look");}}state.fileMode=null;}
  function autosave(){try{const snap=MiniGlk.snapshot();if(snap)localStorage.setItem(AUTO,snap);}catch(e){}}
  function submit(command){const cmd=String(command||"").trim();if(!cmd)return;$("#command").value="";if(!state.ready||!window.MiniGlk){toast("The Guide is still waking up.");return;}const low=cmd.toLowerCase();if(low==="restart"){location.reload();return;}if(low==="save"){openSlots("save");return;}if(low==="restore"){openSlots("restore");return;}if(state.history[state.history.length-1]!==cmd)state.history.push(cmd);state.histIdx=state.history.length;MiniGlk.acceptLine(cmd);setTimeout(scanWorld,40);setTimeout(scanWorld,350);}
  function typeInto(command){const field=$("#command");const cur=field.value.trim();field.value=cur?cur+" "+command:command;field.focus();}
  function showTopic(name){const body=$("#guideEntry");if(!body)return;body.innerHTML="<h3>"+name+"</h3><p>"+(TOPICS[name]||"The Guide has much to say, little of it helpful.")+"</p>";setArt("guide");}
  function bindKeys(){$$("[data-cmd]").forEach(btn=>{btn.addEventListener("click",()=>{const cmd=btn.getAttribute("data-cmd");const mode=btn.getAttribute("data-mode")||"send";if(cmd==="ANY"){const gag=["look","inventory","wait","enjoy life","don't panic","hello","diagnose"];submit(gag[Math.floor(Math.random()*gag.length)]);return;}if(cmd==="save"){openSlots("save");return;}if(cmd==="restore"){openSlots("restore");return;}if(mode==="insert")typeInto(cmd);else submit(cmd);});});const field=$("#command");field.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();submit(field.value);}else if(e.key==="ArrowUp"){e.preventDefault();if(!state.history.length)return;state.histIdx=Math.max(0,state.histIdx-1);field.value=state.history[state.histIdx];}else if(e.key==="ArrowDown"){e.preventDefault();state.histIdx=Math.min(state.history.length,state.histIdx+1);field.value=state.history[state.histIdx]||"";}});$("#go").addEventListener("click",()=>submit(field.value));$("#easyBtn").addEventListener("click",()=>{state.easy=!state.easy;$("#easyBtn").classList.toggle("on",state.easy);$("#easyBtn").textContent=state.easy?"Don't Panic mode":"Classic parser";renderHints(gameText().slice(-1800));});Object.keys(TOPICS).forEach(topic=>{const b=document.createElement("button");b.className="topic";b.textContent=topic;b.addEventListener("click",()=>{showTopic(topic);submit("consult guide about "+topic);});$("#topics").appendChild(b);});$$("[data-slot]").forEach(btn=>btn.addEventListener("click",()=>useSlot(btn.getAttribute("data-slot"))));$("#slotCancel").addEventListener("click",closeSlots);$("#deadRestore").addEventListener("click",()=>{const raw=localStorage.getItem(AUTO);if(!raw){toast("No autosave yet.");return;}const ok=MiniGlk.restoreSnapshot(raw);toast(ok?"Yanked back from the wreckage.":"Autosave would not load.");if(ok){state.dead=false;$("#deadpane").classList.remove("show");MiniGlk._write(MiniGlk.current,"\n[Don't Panic.]\n","cmd");submit("look");}});$("#deadRestart").addEventListener("click",()=>location.reload());}
  function bootScreen(){const boot=$("#boot");const start=()=>{boot.classList.add("hide");setTimeout(()=>boot.style.display="none",900);};boot.addEventListener("click",start);setTimeout(start,1600);}
  async function loadStory(){if(window.STORY_Z3_B64){const bin=atob(window.STORY_Z3_B64);const buf=new ArrayBuffer(bin.length);const view=new Uint8Array(buf);for(let i=0;i<bin.length;i++)view[i]=bin.charCodeAt(i);return buf;}const urls=window.STORY_FETCH_URLS||["story/s4.z3"];let lastErr=null;for(const url of urls){try{const res=await fetch(url);if(res.ok)return await res.arrayBuffer();lastErr=new Error("HTTP "+res.status+" "+url);}catch(e){lastErr=e;}}throw lastErr||new Error("Could not load story file");}
  async function startMachine(){const buf=await loadStory();if(!window.ZVM)throw new Error("ZVM did not load from the CDN");const Glk=window.MiniGlk;const vm=new window.ZVM();Glk.attach($("#windowport"),$("#statusline"));Glk.vm=vm;Glk.onPrint=()=>scanWorld();Glk.onAfterTurn=()=>{autosave();scanWorld();};Glk.onFilePrompt=(data)=>{const func=data&&data.func;openSlots(func==="restore"?"prompt-restore":"prompt-save");};vm.prepare(buf,{Glk:Glk});vm.init();state.ready=true;scanWorld();setTimeout(autosave,400);}
  window.addEventListener("load",async()=>{bindKeys();bootScreen();const cover=artSrc("dont-panic");if($("#art"))$("#art").src=cover;if($("#bootImg"))$("#bootImg").src=cover;state.lastArt="";setArt("dont-panic");try{await startMachine();}catch(e){console.error(e);toast("Could not start the story file.");const port=$("#windowport");if(port)port.textContent=String(e&&e.stack?e.stack:e);}});
  window.GuideConsole={submit,setArt,scanWorld};
})();
