/* Minimal Glk for ifvms ZVM + Hitchhiker's (z3). */
(function (global) {
  function RefBox(v) { this._v = v || 0; }
  RefBox.prototype.set_value = function (v) { this._v = v; };
  RefBox.prototype.get_value = function () { return this._v; };

  function RefStruct() { this._f = []; }
  RefStruct.prototype.push_field = function (v) { this._f.push(v); };
  RefStruct.prototype.get_field = function (i) { return this._f[i]; };
  RefStruct.prototype.set_field = function (i, v) { this._f[i] = v; };

  function bytesToB64(u8) {
    let s = "";
    const step = 0x8000;
    for (let i = 0; i < u8.length; i += step) {
      s += String.fromCharCode.apply(null, u8.subarray(i, i + step));
    }
    return btoa(s);
  }
  function b64ToBytes(b64) {
    const s = atob(b64);
    const u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8;
  }

  const MiniGlk = {
    RefBox: RefBox,
    RefStruct: RefStruct,
    vm: null,
    current: null,
    windows: [],
    pending: null,
    selectEvent: null,
    lineBuf: null,
    lineInit: 0,
    statusEl: null,
    mainEl: null,
    onPrint: null,
    onFilePrompt: null,
    onAfterTurn: null,

    attach: function (mainEl, statusEl) {
      this.mainEl = mainEl;
      this.statusEl = statusEl;
    },

    fatal_error: function (e) {
      console.error(e);
      const msg = (e && e.stack) ? e.stack : String(e);
      if (this.mainEl) {
        const pre = document.createElement("div");
        pre.className = "fatal";
        pre.textContent = "Guide fault: " + msg;
        this.mainEl.appendChild(pre);
      }
    },

    update: function () {},

    glk_gestalt: function () { return 0; },
    glk_stylehint_set: function () {},
    glk_stylehint_clear: function () {},
    glk_set_style: function () {},
    garglk_set_reversevideo: function () {},
    garglk_set_reversevideo_stream: function () {},
    garglk_set_zcolors_stream: function () {},

    glk_window_open: function (splitwin, method, size, wintype, rock) {
      const win = {
        id: this.windows.length + 1,
        type: wintype,
        rock: rock,
        parent: splitwin || null,
        size: size,
        text: "",
      };
      win.str = { win: win, id: win.id };
      this.windows.push(win);
      if (wintype === 3 && !this.current) this.current = win;
      return win;
    },

    glk_window_close: function (win) {
      this.windows = this.windows.filter((w) => w !== win);
      if (this.current === win) this.current = this.windows[0] || null;
    },

    glk_window_get_parent: function (win) { return win && win.parent; },
    glk_window_get_stream: function (win) { return win && win.str; },
    glk_window_iterate: function () { return 0; },
    glk_window_set_arrangement: function () {},
    glk_window_move_cursor: function () {},
    glk_window_clear: function (win) {
      if (!win) return;
      win.text = "";
      if (win.rock === 202 && this.statusEl) this.statusEl.textContent = "";
    },
    glk_window_get_size: function (win, widthBox, heightBox) {
      if (widthBox && widthBox.set_value) widthBox.set_value(80);
      if (heightBox && heightBox.set_value) {
        heightBox.set_value(win && win.type === 4 ? (win.size || 1) : 24);
      }
    },

    glk_set_window: function (win) { this.current = win; },

    glk_put_jstring: function (text) { this._write(this.current, text); },
    glk_put_jstring_stream: function (str, text) { this._write(str && str.win, text); },
    glk_put_char_stream_uni: function (str, code) {
      this._write(str && str.win, String.fromCodePoint(code));
    },
    glk_put_buffer_stream: function (str, arr) {
      if (str && str.isFile) {
        str.data = arr instanceof Uint8Array ? arr : new Uint8Array(arr);
        if (str.slot) {
          try { localStorage.setItem(str.slot, bytesToB64(str.data)); } catch (e) {}
        }
        return;
      }
      this._write(str && str.win, String.fromCharCode.apply(null, arr));
    },

    _write: function (win, text, kind) {
      if (!text) return;
      if (!win) win = this.current;
      if (!win) return;
      if (win.type === 4 || win.rock === 202) {
        win.text += text;
        if (this.statusEl) {
          let shown = win.text.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
          const hits = shown.match(/[A-Za-z][\w '\-/,]*Score:\s*\d+\s*Turns:\s*\d+/g);
          if (hits) {
            shown = hits[hits.length - 1]
              .replace(/Score:/, " · Score:")
              .replace(/Turns:/, " · Turns:");
          }
          this.statusEl.textContent = shown.slice(-96);
        }
        return;
      }
      win.text += text;
      if (this.mainEl) {
        const cls = kind === "cmd" ? "cmd-line" : "out-line";
        const parts = String(text).split("\n");
        for (let i = 0; i < parts.length; i++) {
          if (i > 0) this.mainEl.appendChild(document.createElement("br"));
          if (parts[i]) {
            const span = document.createElement("span");
            span.className = cls;
            span.textContent = parts[i];
            this.mainEl.appendChild(span);
          }
        }
        this.mainEl.scrollTop = this.mainEl.scrollHeight;
      }
      if (this.onPrint) this.onPrint(text);
    },

    glk_stream_iterate: function () { return 0; },
    glk_stream_close: function () {},
    glk_stream_open_file: function (fref, mode) {
      if (!fref) return null;
      let data = fref.data || new Uint8Array(0);
      if ((!data || !data.length) && fref.slot) {
        try {
          const raw = localStorage.getItem(fref.slot);
          if (raw) data = b64ToBytes(raw);
        } catch (e) {}
      }
      return { isFile: true, fref: fref, mode: mode, data: data, slot: fref.slot };
    },
    glk_stream_open_file_uni: function (fref, mode) {
      return this.glk_stream_open_file(fref, mode);
    },
    glk_get_buffer_stream: function (str, dest) {
      if (!str || !str.data || !dest) return 0;
      const n = Math.min(str.data.length, dest.length);
      for (let i = 0; i < n; i++) dest[i] = str.data[i];
      return n;
    },
    glk_get_char_stream_uni: function () { return -1; },
    glk_get_line_stream_uni: function () { return 0; },

    glk_fileref_create_by_prompt: function (usage, mode, rock) {
      this.pending = { type: "fileref", usage: usage, mode: mode, rock: rock };
    },
    glk_fileref_destroy: function () {},

    glk_request_line_event_uni: function (win, buffer, initlen) {
      this.lineBuf = buffer;
      this.lineInit = initlen || 0;
      this.pending = { type: "line", win: win };
    },
    glk_request_char_event_uni: function (win) {
      this.pending = { type: "char", win: win };
    },

    glk_select: function (event) { this.selectEvent = event; },
    glk_exit: function () {},

    _filePending: function () {
      const ev = this.selectEvent;
      if (!ev) return false;
      const f = ev.get_field ? ev.get_field(0) : ev._f && ev._f[0];
      return f === "fileref_create_by_prompt" || (this.pending && this.pending.type === "fileref");
    },

    acceptLine: function (text) {
      const line = String(text || "").replace(/\r/g, "");
      this._write(this.current, line + "\n", "cmd");
      if (this.lineBuf) {
        const max = this.lineBuf.length || 256;
        const n = Math.min(line.length, max);
        for (let i = 0; i < n; i++) this.lineBuf[i] = line.charCodeAt(i);
      }
      if (this.selectEvent) {
        this.selectEvent._f = [3, this.pending && this.pending.win, line.length, 10];
      }
      this.pending = null;
      if (this.vm && this.vm.resume) this.vm.resume();
      if (this._filePending() && this.onFilePrompt) {
        this.onFilePrompt(this.vm && this.vm.fileref_data);
        return;
      }
      if (this.onAfterTurn) this.onAfterTurn();
    },

    finishFilePrompt: function (slotKey, existingB64) {
      const fref = {
        slot: slotKey,
        data: existingB64 ? b64ToBytes(existingB64) : new Uint8Array(0),
      };
      if (this.vm && this.vm.resume) this.vm.resume(fref);
      if (this.onAfterTurn) this.onAfterTurn();
    },

    cancelFilePrompt: function () {
      if (this.vm && this.vm.resume) this.vm.resume(null);
    },

    acceptChar: function (code) {
      if (this.selectEvent) this.selectEvent._f = [2, this.pending && this.pending.win, code];
      this.pending = null;
      if (this.vm && this.vm.resume) this.vm.resume();
    },

    snapshot: function () {
      if (!this.vm || !this.vm.save_file) return null;
      try {
        const raw = this.vm.save_file(this.vm.pc);
        return bytesToB64(raw instanceof Uint8Array ? raw : new Uint8Array(raw));
      } catch (e) {
        console.warn("snapshot failed", e);
        return null;
      }
    },

    restoreSnapshot: function (b64) {
      if (!this.vm || !this.vm.restore_file || !b64) return false;
      try {
        const u8 = b64ToBytes(b64);
        return !!this.vm.restore_file(u8.buffer);
      } catch (e) {
        console.warn("restore failed", e);
        return false;
      }
    },

    save_allstate: function () { return null; },
    restore_allstate: function () {},
    bytesToB64: bytesToB64,
    b64ToBytes: b64ToBytes,
  };

  global.MiniGlk = MiniGlk;
})(window);
