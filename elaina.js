#!/usr/bin/env node
"use strict";

// ════════════════════════════════════════════════════════════
//  ELAINA v3 — CLI
//  Usage:
//    elaina run <file.ela>          Run a .ela file
//    elaina run <file.ela> --async  Run with async support (summon, await)
//    elaina check <file.ela>        Syntax check only
//    elaina repl                    Interactive REPL
//    elaina version                 Print version info
// ════════════════════════════════════════════════════════════

const fs       = require("fs");
const path     = require("path");
const readline = require("readline");

const { Lexer }       = require("./src/lexer");
const { Parser }      = require("./src/parser");
const { Interpreter } = require("./src/interpreter");

const VERSION = "3.0.0";
const BANNER  = `
  ╔═══════════════════════════════════╗
  ║   ✦  ELAINA  v${VERSION}  ✦          ║
  ║   A spell-powered language        ║
  ╚═══════════════════════════════════╝
`.trimStart();

// ── Colour helpers ────────────────────────────────────────
const C = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  red:    "\x1b[31m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  cyan:   "\x1b[36m",
  magenta:"\x1b[35m",
  grey:   "\x1b[90m",
};
const c = (col, s) => `${C[col]}${s}${C.reset}`;

// ── Error display ─────────────────────────────────────────
function displayError(err, filename = "") {
  const line = err.line ?? err.elaLine ?? "?";
  console.error(c("red", `\n✦ Error`) + (filename ? c("dim", ` in ${filename}`) : ""));
  console.error(c("red", `  Line ${line}: `) + err.message.replace(/^\[.*?\]\s*/, ""));
  if (process.env.ELAINA_DEBUG) console.error(err.stack);
}

// ── Run a .ela file ───────────────────────────────────────
async function runFile(filepath, opts = {}) {
  if (!fs.existsSync(filepath)) {
    console.error(c("red", `File not found: ${filepath}`));
    process.exit(1);
  }
  if (!filepath.endsWith(".ela") && !opts.force) {
    console.warn(c("yellow", `Warning: '${filepath}' does not have a .ela extension`));
  }

  const source  = fs.readFileSync(filepath, "utf8");
  const baseDir = path.dirname(path.resolve(filepath));
  const interp  = new Interpreter({ filename: filepath, baseDir });

  try {
    if (opts.async) {
      await interp.runAsync(source);
    } else {
      interp.run(source);
    }
  } catch (err) {
    displayError(err, path.basename(filepath));
    process.exit(1);
  }
}

// ── Syntax check only ─────────────────────────────────────
function checkFile(filepath) {
  if (!fs.existsSync(filepath)) {
    console.error(c("red", `File not found: ${filepath}`));
    process.exit(1);
  }
  const source = fs.readFileSync(filepath, "utf8");
  try {
    const tokens = new Lexer(source, filepath).tokenize();
    new Parser(tokens).parse();
    console.log(c("green", `✓ ${filepath} — syntax OK`));
  } catch (err) {
    displayError(err, path.basename(filepath));
    process.exit(1);
  }
}

// ── Interactive REPL ──────────────────────────────────────
function startRepl() {
  console.log(BANNER);
  console.log(c("dim", "  Type Elaina code. 'quit' or Ctrl+C to exit.\n"));

  const interp  = new Interpreter();
  const history = [];
  let   multiline = "";
  let   inBlock   = false;

  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
    prompt: inBlock ? c("cyan", "  ... ") : c("magenta", "✦ elf> "),
    history,
    historySize: 200,
  });

  rl.prompt();

  rl.on("line", (rawLine) => {
    const line = rawLine;

    if (line.trim() === "quit" || line.trim() === "exit") {
      console.log(c("dim", "\n  Farewell, adventurer. ✦\n"));
      process.exit(0);
    }
    if (line.trim() === "clear") { console.clear(); rl.prompt(); return; }
    if (line.trim() === "help") {
      console.log(c("cyan", [
        "",
        "  Commands: quit / clear / help",
        "  Keywords: let  say  if  else  elif  loop  while  spell  cast",
        "            enchant  import  try  catch  raise  summon  give back",
        "  Types:    number  string  boolean  list  dict  nothing",
        "",
      ].join("\n")));
      rl.prompt();
      return;
    }

    // Detect start of block (line ends with :)
    const trimmed = line.trimEnd();
    if (trimmed.endsWith(":")) {
      multiline += line + "\n";
      inBlock = true;
      rl.setPrompt(c("cyan", "  ... "));
      rl.prompt();
      return;
    }

    // Inside a block: accumulate until blank line
    if (inBlock) {
      if (line.trim() === "") {
        // Execute the accumulated block
        const src = multiline;
        multiline = "";
        inBlock   = false;
        rl.setPrompt(c("magenta", "✦ elf> "));
        try { interp.run(src); } catch (err) { displayError(err); }
        rl.prompt();
      } else {
        multiline += line + "\n";
        rl.prompt();
      }
      return;
    }

    // Single-line execution
    if (line.trim() === "") { rl.prompt(); return; }
    try { interp.run(line); } catch (err) { displayError(err); }
    rl.prompt();
  });

  rl.on("close", () => {
    console.log(c("dim", "\n  Farewell. ✦\n"));
    process.exit(0);
  });
}

// ── Main CLI dispatcher ───────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const cmd  = args[0];

  if (!cmd || cmd === "--help" || cmd === "-h") {
    console.log(BANNER);
    console.log([
      c("bold", "  Usage:"),
      `    ${c("cyan", "elaina run")} <file.ela> ${c("dim", "[--async]")}   Run a program`,
      `    ${c("cyan", "elaina check")} <file.ela>          Check syntax`,
      `    ${c("cyan", "elaina repl")}                      Interactive REPL`,
      `    ${c("cyan", "elaina version")}                   Show version`,
      "",
      c("bold", "  Examples:"),
      `    elaina run hello.ela`,
      `    elaina run main.ela --async`,
      `    elaina repl`,
      "",
      c("bold", "  Environment:"),
      `    ANTHROPIC_API_KEY   Enable 'summon' AI commands`,
      `    ELAINA_DEBUG=1      Show full stack traces`,
      "",
    ].join("\n"));
    return;
  }

  if (cmd === "version" || cmd === "--version" || cmd === "-v") {
    console.log(`Elaina v${VERSION} ✦`);
    return;
  }

  if (cmd === "repl") {
    startRepl();
    return;
  }

  if (cmd === "run") {
    const file  = args[1];
    const async_ = args.includes("--async");
    if (!file) { console.error(c("red", "Usage: elaina run <file.ela>")); process.exit(1); }
    await runFile(file, { async: async_ });
    return;
  }

  if (cmd === "check") {
    const file = args[1];
    if (!file) { console.error(c("red", "Usage: elaina check <file.ela>")); process.exit(1); }
    checkFile(file);
    return;
  }

  // Direct file shorthand: elaina myfile.ela
  if (cmd.endsWith(".ela")) {
    await runFile(cmd, { async: args.includes("--async"), force: true });
    return;
  }

  console.error(c("red", `Unknown command: '${cmd}'. Run 'elaina --help' for usage.`));
  process.exit(1);
}

main().catch(err => {
  console.error(c("red", "Fatal: " + err.message));
  if (process.env.ELAINA_DEBUG) console.error(err.stack);
  process.exit(1);
});
