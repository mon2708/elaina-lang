#!/usr/bin/env node
"use strict";

// ════════════════════════════════════════════════════════════
//  ELAINA GAME RUNNER
//  Usage: node elaina-game.js <file.ela>
//  Wraps the Elaina interpreter with game loop + keypress
// ════════════════════════════════════════════════════════════

const fs   = require("fs");
const path = require("path");
const { Interpreter }  = require("./src/interpreter");
const { GameRuntime }  = require("./src/gameruntime");
const { ElainaList, elainaStr } = require("./src/stdlib");

const filepath = process.argv[2];
if (!filepath) {
  console.error("Usage: node elaina-game.js <file.ela>");
  process.exit(1);
}

const source  = fs.readFileSync(filepath, "utf8");
const baseDir = path.dirname(path.resolve(filepath));

// Output goes to stdout directly (game uses rawPrint/printAt)
const interp  = new Interpreter({
  outputFn: (s) => process.stdout.write(String(s) + "\n"),
  filename: filepath,
  baseDir,
});

const runtime = new GameRuntime(interp);
runtime.register();

// Register gameLoop — the .ela file calls this to start the game
interp.globalEnv.define("__startGameLoop__", {
  __builtin__: true,
  name: "__startGameLoop__",
  call: ([tickSpell, fps]) => {
    runtime.start(() => {
      try {
        interp.callCallable(tickSpell, []);
      } catch (err) {
        runtime.stop();
        console.error("\nGame error:", err.message);
        process.exit(1);
      }
    }, fps ?? 8);
    return null;
  }
});

// Run the .ela file (defines spells + calls startGame)
try {
  interp.run(source);
} catch (err) {
  runtime.stop();
  console.error("Error:", err.message);
  process.exit(1);
}