window.GuideData = (function () {
  const ART = {
    "dont-panic": { cap: "COVER / DON'T PANIC", file: "dont-panic", hue: 8, mark: "cover" },
    bedroom: { cap: "LOCAL / BEDROOM / EARTH", file: "bedroom", hue: 28, mark: "bed" },
    house: { cap: "LOCAL / FRONT OF HOUSE", file: "earth-house", hue: 42, mark: "house" },
    lane: { cap: "LOCAL / COUNTRY LANE", file: "lane", hue: 88, mark: "lane" },
    pub: { cap: "LOCAL / PUB / PEANUTS AND BEER", file: "pub", hue: 32, mark: "pub" },
    earth: { cap: "PLANET / EARTH / MOSTLY HARMLESS", file: "earth", hue: 200, mark: "earth" },
    space: { cap: "DEEP SPACE / IN TRANSIT", file: "space", hue: 230, mark: "space" },
    vogon: { cap: "VOGON CONSTRUCTOR FLEET", file: "vogon", hue: 130, mark: "vogon" },
    poetry: { cap: "VOGON / POETRY APPRECIATION", file: "vogon", hue: 140, mark: "poetry" },
    hog: { cap: "STARSHIP / HEART OF GOLD", file: "heart-of-gold", hue: 168, mark: "hog" },
    magrathea: { cap: "PLANET / MAGRATHEA", file: "magrathea", hue: 265, mark: "mag" },
    dark: { cap: "THE DARK / DO NOT PANIC", file: "space", hue: 0, mark: "dark" },
    whale: { cap: "DEEP SPACE / SUDDEN WHALE", file: "space", hue: 210, mark: "whale" },
    guide: { cap: "DEVICE / THE GUIDE", file: "guide-open", hue: 18, mark: "guide" }
  };

  const ROOM_KEYS = [
    { key: "poetry", test: /captain|poetry appreciation|hold music/i },
    { key: "vogon", test: /vogon hold|vogon constructor|hold of the vogon/i },
    { key: "pub", test: /\bpub\b/i },
    { key: "lane", test: /country lane|\blane\b/i },
    { key: "house", test: /front of (your |the )?house|front porch/i },
    { key: "bedroom", test: /\bbedroom\b/i },
    { key: "hog", test: /heart of gold|bridge|galley|sauna|entry bay|corridor/i },
    { key: "magrathea", test: /magrathea|factory fjord|slartibartfast|matter look/i },
    { key: "dark", test: /^\s*dark\b|the dark/i },
    { key: "whale", test: /sperm whale|bowl of petunias/i },
    { key: "earth", test: /planet earth|mostly harmless/i },
    { key: "space", test: /airlock|hyperspace|darkness of space/i }
  ];

  const SCENE_HINTS = {
    bedroom: {
      notice: "Small room. Large day ahead. The Guide recommends pockets, then exits.",
      cmds: (ctx) => {
        const out = [];
        if (ctx.dark) out.push("turn on light");
        if (ctx.inBed) out.push("get up");
        if (!ctx.has("gown") && !ctx.has("dressing gown")) out.push("get gown");
        else if (!ctx.wearingGown) out.push("wear gown");
        else out.push("look in pocket");
        if (!ctx.has("screwdriver")) out.push("get screwdriver");
        if (!ctx.has("toothbrush")) out.push("get toothbrush");
        if (ctx.has("tablet") || ctx.has("aspirin") || /tablet|aspirin/.test(ctx.turn)) out.push("take tablet");
        out.push("south");
        return out;
      }
    },
    house: {
      notice: "A civil servant and a bulldozer are having a disagreement with your home.",
      cmds: () => ["examine bulldozer", "lie down", "wait", "examine prosser"]
    },
    lane: {
      notice: "The lane still leads to a pub. The planet, less so.",
      cmds: () => ["look", "north", "south", "wait"]
    },
    pub: {
      notice: "Ford will attempt to explain the end of the world. Drink first.",
      cmds: () => ["buy sandwich", "drink beer", "wait", "eat peanuts"]
    },
    vogon: {
      notice: "The dispenser is playing a crueler game than vending. Look at the room, not the prize.",
      cmds: (ctx) => {
        const t = ctx.turn;
        if (/hole|hook/.test(t)) return ["examine hook", "examine gown", "examine dispenser"];
        if (/drain|grating/.test(t)) return ["examine drain", "examine towel", "look"];
        if (/cleaning robot|panel/.test(t)) return ["examine panel", "examine satchel", "look"];
        if (/flying junk|mail/.test(t)) return ["examine mail", "examine satchel", "look"];
        return ["look", "examine dispenser", "examine hook", "inventory"];
      }
    },
    poetry: {
      notice: "Vogon poetry is the third worst in the Universe. Listening is not optional.",
      cmds: () => ["listen", "look", "wait"]
    },
    hog: {
      notice: "A ship that runs on improbability. Doors have opinions. Tea is a political issue.",
      cmds: () => ["look", "inventory", "port", "starboard"]
    },
    magrathea: {
      notice: "Closed for business is a relative term on a planet factory.",
      cmds: () => ["look", "wait", "inventory"]
    },
    dark: {
      notice: "The Dark is not a room so much as a suggestion. Use the other four senses.",
      cmds: () => ["look", "listen", "smell", "feel", "taste"]
    },
    whale: {
      notice: "You appear to have become a whale. This is not covered by most insurance.",
      cmds: () => ["look", "wait", "examine tail"]
    },
    space: {
      notice: "Between places. Hold on to the thumb.",
      cmds: () => ["look", "inventory", "wait"]
    },
    earth: {
      notice: "Mostly harmless. Officially.",
      cmds: () => ["look", "wait"]
    }
  };

  const NOUNS = [
    "gown", "pocket", "screwdriver", "toothbrush", "tablet", "aspirin",
    "phone", "bed", "curtain", "window", "light", "bulldozer", "prosser",
    "ford", "towel", "satchel", "thumb", "sandwich", "beer", "peanuts",
    "babel fish", "dispenser", "panel", "hook", "drain", "mail", "fluff",
    "tea", "cup", "machine", "keypad", "marvin", "sachet", "junk mail",
    "switch", "case", "plotter"
  ];

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
    panic: "The cover is printed in large friendly letters for a reason.",
    dark: "Not a place. More of an atmosphere. The Guide's usual advice is to stop expecting walls.",
    "heart of gold": "Stolen, improbably. The doors are proud of themselves. Nobody asked them."
  };

  const DEATH_RE = /\*\*\*[^*\n]*died|\byou have died\b|\byou are dead\b|better luck next life|\byou black out\b|\byou have been killed\b/i;
  return { ART, ROOM_KEYS, SCENE_HINTS, NOUNS, TOPICS, DEATH_RE };
})();
