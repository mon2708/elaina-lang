"use strict";

// ════════════════════════════════════════════════════════════
//  ELAINA v3 — GAME RUNTIME EXTENSION
//  Adds native support for:
//  - Real-time keypress detection
//  - setInterval game loop
//  - Terminal clear + cursor control
//  - Screen buffer rendering
// ════════════════════════════════════════════════════════════

const readline = require("readline");
const { ElainaList, elainaStr } = require("./stdlib");

class GameRuntime {
  constructor(interpreter) {
    this.interp   = interpreter;
    this.keys     = new Set();
    this.lastKey  = null;
    this.running  = false;
    this.interval = null;
  }

  // ── Terminal helpers ──────────────────────────────────────
  clear()       { process.stdout.write("\x1b[2J\x1b[H"); }
  moveTo(r, c)  { process.stdout.write(`\x1b[${r+1};${c+1}H`); }
  hideCursor()  { process.stdout.write("\x1b[?25l"); }
  showCursor()  { process.stdout.write("\x1b[?25h"); }
  print(s)      { process.stdout.write(String(s)); }
  println(s)    { process.stdout.write(String(s) + "\n"); }

  // ── Keypress setup ────────────────────────────────────────
  setupInput() {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.on("keypress", (str, key) => {
      if (!key) return;
      if (key.ctrl && key.name === "c") {
        this.stop();
        process.exit(0);
      }
      const name = key.name || str;
      this.lastKey = name;
      this.keys.add(name);
      setTimeout(() => this.keys.delete(name), 100);
    });
  }

  // ── Game loop ─────────────────────────────────────────────
  start(tickFn, fps = 10) {
    this.running = true;
    this.setupInput();
    this.hideCursor();
    const ms = Math.floor(1000 / fps);
    this.interval = setInterval(() => {
      if (!this.running) return;
      tickFn();
    }, ms);
  }

  stop() {
    this.running = false;
    if (this.interval) clearInterval(this.interval);
    this.showCursor();
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
  }

  // ── Register builtins into interpreter env ────────────────
  register() {
    const env  = this.interp.globalEnv;
    const self = this;

    const def = (name, fn) =>
      env.define(name, { __builtin__: true, name, call: fn });

    def("clearScreen",  ()     => { self.clear(); return null; });
    def("printAt",      ([r,c,s]) => { self.moveTo(r,c); self.print(s); return null; });
    def("getKey",       ()     => self.lastKey ?? null);
    def("clearKey",     ()     => { self.lastKey = null; return null; });
    def("gameSleep",    ()     => null); // handled by interval
    def("gameRunning",  ()     => self.running);
    def("stopGame",     ()     => { self.stop(); return null; });
    def("printLine",    ([s])  => { self.println(s); return null; });
    def("rawPrint",     ([s])  => { self.print(s); return null; });
  }
}

module.exports = { GameRuntime };