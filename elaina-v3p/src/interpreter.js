"use strict";

// ════════════════════════════════════════════════════════════
//  ELAINA v3 — INTERPRETER
//  Tree-walking executor. Evaluates every AST node produced
//  by the Parser, manages scopes via Environment, and calls
//  into the standard library for built-in functions/modules.
// ════════════════════════════════════════════════════════════

const path = require("path");
const fs   = require("fs");
const readline = require("readline");

const { Lexer }        = require("./lexer");
const { Parser }       = require("./parser");
const { Environment, RuntimeError, ReturnSignal, BreakSignal, ContinueSignal } = require("./environment");
const {
  STDLIB, buildGlobals,
  ElainaList, ElainaDict, ElainaInstance, ElainaClass, BoundMethod, elainaStr,
} = require("./stdlib");

// ── Summon (AI) config ────────────────────────────────────
// Real API call — requires ANTHROPIC_API_KEY in environment
const SUMMON_MODEL = "claude-haiku-4-5-20251001";

// ─────────────────────────────────────────────────────────────
//  Main Interpreter class
// ─────────────────────────────────────────────────────────────

class Interpreter {
  constructor({ outputFn = console.log, inputFn = null, filename = "<stdin>", baseDir = process.cwd() } = {}) {
    this.output    = outputFn;
    this.inputFn   = inputFn;   // async (prompt) => string
    this.filename  = filename;
    this.baseDir   = baseDir;
    this.globalEnv = new Environment(null, "<global>");
    this._moduleCache = {};

    buildGlobals(this.globalEnv, outputFn);
  }

  // ── Public entry points ───────────────────────────────────

  /** Run source string synchronously (no await/ask) */
  run(source) {
    const ast = this._parse(source);
    this._execBlock(ast.body, this.globalEnv);
  }

  /** Run source string, supports async/await + ask */
  async runAsync(source) {
    const ast = this._parse(source);
    await this._execBlockAsync(ast.body, this.globalEnv);
  }

  // ── Parsing ───────────────────────────────────────────────

  _parse(source) {
    const tokens = new Lexer(source, this.filename).tokenize();
    return new Parser(tokens).parse();
  }

  // ── Block execution ───────────────────────────────────────

  _execBlock(stmts, env) {
    for (const stmt of stmts) {
      const sig = this._execStmt(stmt, env);
      if (sig instanceof ReturnSignal || sig instanceof BreakSignal || sig instanceof ContinueSignal) return sig;
    }
  }

  async _execBlockAsync(stmts, env) {
    for (const stmt of stmts) {
      const sig = await this._execStmtAsync(stmt, env);
      if (sig instanceof ReturnSignal || sig instanceof BreakSignal || sig instanceof ContinueSignal) return sig;
    }
  }

  // ── Statement dispatch ────────────────────────────────────

  _execStmt(stmt, env) {
    switch (stmt.type) {
      case "SayStmt":       return this._execSay(stmt, env);
      case "LetStmt":       return this._execLet(stmt, env);
      case "AssignStmt":    return this._execAssign(stmt, env);
      case "ExprStmt":      this._eval(stmt.expr, env); return;
      case "IfStmt":        return this._execIf(stmt, env);
      case "LoopRangeStmt": return this._execLoopRange(stmt, env);
      case "LoopInStmt":    return this._execLoopIn(stmt, env);
      case "WhileStmt":     return this._execWhile(stmt, env);
      case "BreakStmt":     return new BreakSignal();
      case "ContinueStmt":  return new ContinueSignal();
      case "SpellStmt":     return this._defineSpell(stmt, env);
      case "EnchantStmt":   return this._defineEnchant(stmt, env);
      case "CastStmt":      this._eval(stmt.expr, env); return;
      case "ReturnStmt":    return new ReturnSignal(this._eval(stmt.value, env));
      case "ImportStmt":    return this._execImport(stmt, env);
      case "TryCatch":      return this._execTryCatch(stmt, env);
      case "RaiseStmt":     this._execRaise(stmt, env); return;
      case "SummonStmt":    return this._execSummonSync(stmt, env);
      default: throw new RuntimeError(`Unknown statement: ${stmt.type}`, stmt.line);
    }
  }

  async _execStmtAsync(stmt, env) {
    if (stmt.type === "SummonStmt") return await this._execSummon(stmt, env);
    if (stmt.type === "SpellStmt" && stmt.isAsync) return this._defineSpell(stmt, env);
    // Delegate the rest synchronously but wrap
    return this._execStmt(stmt, env);
  }

  // ── Individual statement handlers ────────────────────────

  _execSay(stmt, env) {
    this.output(elainaStr(this._eval(stmt.expr, env)));
  }

  _execLet(stmt, env) {
    env.set(stmt.name, this._eval(stmt.value, env), stmt.line);
  }

  _execAssign(stmt, env) {
    const val = this._eval(stmt.value, env);
    const target = stmt.target;
    const op = stmt.op;

    if (target.type === "Identifier") {
      const cur = op !== "=" ? env.get(target.name, stmt.line) : null;
      const newVal = this._applyAugmented(op, cur, val);
      env.set(target.name, newVal, stmt.line);
      return;
    }
    if (target.type === "IndexExpr") {
      const obj = this._eval(target.object, env);
      const idx = this._eval(target.index, env);
      const cur = op !== "=" ? this._getIndex(obj, idx, stmt.line) : null;
      const newVal = this._applyAugmented(op, cur, val);
      this._setIndex(obj, idx, newVal, stmt.line);
      return;
    }
    if (target.type === "MemberExpr") {
      const obj = this._eval(target.object, env);
      const prop = target.property;
      const cur = op !== "=" ? this._getMember(obj, prop, stmt.line) : null;
      const newVal = this._applyAugmented(op, cur, val);
      this._setMember(obj, prop, newVal, stmt.line);
      return;
    }
    throw new RuntimeError("Invalid assignment target", stmt.line);
  }

  _applyAugmented(op, cur, val) {
    if (op === "=")  return val;
    if (op === "+=") return (typeof cur === "string" || typeof val === "string") ? String(cur) + String(val) : cur + val;
    if (op === "-=") return cur - val;
    throw new RuntimeError(`Unknown assignment operator: ${op}`);
  }

  _execIf(stmt, env) {
    for (const { cond, block } of stmt.branches) {
      if (this.isTruthy(this._eval(cond, env))) {
        return this._execBlock(block, env.child("if"));
      }
    }
    if (stmt.elseBlock) return this._execBlock(stmt.elseBlock, env.child("else"));
  }

  _execLoopRange(stmt, env) {
    const from = this._eval(stmt.from, env);
    const to   = this._eval(stmt.to, env);
    for (let i = from; i <= to; i++) {
      const loopEnv = env.child("loop");
      loopEnv.define(stmt.varName, i);
      const sig = this._execBlock(stmt.body, loopEnv);
      if (sig instanceof ReturnSignal) return sig;
      if (sig instanceof BreakSignal)    break;
      // ContinueSignal → just continue the loop
    }
  }

  _execLoopIn(stmt, env) {
    const iterable = this._eval(stmt.iterable, env);
    const items = this._toIterable(iterable, stmt.line);
    for (const item of items) {
      const loopEnv = env.child("loop-in");
      loopEnv.define(stmt.varName, item);
      const sig = this._execBlock(stmt.body, loopEnv);
      if (sig instanceof ReturnSignal) return sig;
      if (sig instanceof BreakSignal)    break;
    }
  }

  _execWhile(stmt, env) {
    let guard = 0;
    while (this.isTruthy(this._eval(stmt.cond, env))) {
      if (++guard > 1_000_000) throw new RuntimeError("Infinite loop detected (>1M iterations)", stmt.line);
      const sig = this._execBlock(stmt.body, env.child("while"));
      if (sig instanceof ReturnSignal) return sig;
      if (sig instanceof BreakSignal)    break;
    }
  }

  _defineSpell(stmt, env) {
    const spell = {
      __spell__: true,
      name:      stmt.name,
      params:    stmt.params,
      body:      stmt.body,
      closure:   env,
      isAsync:   stmt.isAsync,
    };
    env.define(stmt.name, spell);
  }

  _defineEnchant(stmt, env) {
    const methods = {};
    for (const m of stmt.methods) {
      methods[m.name] = {
        __spell__: true,
        name:    m.name,
        params:  m.params,
        body:    m.body,
        closure: env,
        isAsync: m.isAsync,
      };
    }

    const parent = stmt.parent ? (() => {
      const p = env.get(stmt.parent, stmt.line);
      if (!(p instanceof ElainaClass)) throw new RuntimeError(`'${stmt.parent}' is not a class`, stmt.line);
      return p;
    })() : null;

    const klass = new ElainaClass(stmt.name, parent, methods);
    env.define(stmt.name, klass);
  }

  _execImport(stmt, env) {
    const modName = stmt.path;

    // Built-in stdlib module?
    if (modName in STDLIB) {
      const mod    = STDLIB[modName];
      const target = stmt.alias ?? modName;
      const dict   = new ElainaDict();
      for (const [k, fn] of Object.entries(mod)) {
        if (typeof fn === "function") {
          dict.set(k, { __builtin__: true, name: `${modName}.${k}`, call: fn });
        } else {
          dict.set(k, fn);
        }
      }
      env.define(target, dict);
      return;
    }

    // File-based module
    const candidates = [
      path.resolve(this.baseDir, modName + ".ela"),
      path.resolve(this.baseDir, modName, "index.ela"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        if (this._moduleCache[p]) {
          env.define(stmt.alias ?? path.basename(p, ".ela"), this._moduleCache[p]);
          return;
        }
        const src    = fs.readFileSync(p, "utf8");
        const modEnv = new Environment(null, `module:${p}`);
        buildGlobals(modEnv, this.output);
        const interp = new Interpreter({ outputFn: this.output, filename: p, baseDir: path.dirname(p) });
        interp.globalEnv = modEnv;
        interp.run(src);
        const dict = new ElainaDict();
        for (const [k, v] of Object.entries(modEnv.vars)) dict.set(k, v);
        this._moduleCache[p] = dict;
        env.define(stmt.alias ?? path.basename(p, ".ela"), dict);
        return;
      }
    }
    throw new RuntimeError(`Module '${modName}' not found`, stmt.line);
  }

  _execTryCatch(stmt, env) {
    try {
      this._execBlock(stmt.tryBlock, env.child("try"));
    } catch (err) {
      const catchEnv = env.child("catch");
      catchEnv.define(stmt.errName, err.message ?? String(err));
      this._execBlock(stmt.catchBlock, catchEnv);
    }
  }

  _execRaise(stmt, env) {
    const msg = elainaStr(this._eval(stmt.expr, env));
    throw new RuntimeError(msg, stmt.line);
  }

  _execSummonSync(stmt, env) {
    // Sync version: warn and mock (for environments without API key)
    this.output("[summon] Note: use 'await' or async context for real AI responses");
    const mock = `# Summoned code for: "${stmt.prompt}"\nsay "Summoned!"`;
    if (stmt.target) env.set(stmt.target, mock, stmt.line);
    else this.output(mock);
  }

  async _execSummon(stmt, env) {
    const prompt = elainaStr(this._eval({ type: "StringLit", value: stmt.prompt }, env));
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      this.output("[summon] No ANTHROPIC_API_KEY set — returning mock response");
      const mock = `spell generated():\n    say "Hello from summon!"`;
      if (stmt.target) env.set(stmt.target, mock, stmt.line);
      else this.output(mock);
      return;
    }

    this.output(`[summon] Asking the oracle: "${prompt}"...`);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model:      SUMMON_MODEL,
          max_tokens: 1024,
          system:     "You are Elaina, a fantasy programming language assistant. Respond only with valid Elaina code. No explanations.",
          messages:   [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      const result = data?.content?.[0]?.text ?? "# No response";
      if (stmt.target) env.set(stmt.target, result, stmt.line);
      else this.output(result);
    } catch (err) {
      throw new RuntimeError(`Summon failed: ${err.message}`, stmt.line);
    }
  }

  // ── Expression evaluation ─────────────────────────────────

  _eval(expr, env) {
    switch (expr.type) {
      case "NumberLit":  return expr.value;
      case "StringLit":  return expr.value;
      case "BoolLit":    return expr.value;
      case "NullLit":    return null;
      case "Identifier": return env.get(expr.name, expr.line);
      case "ListLit":    return new ElainaList(expr.elements.map(e => this._eval(e, env)));
      case "DictLit":    return new ElainaDict(expr.pairs.map(([k, v]) => [this._eval(k, env), this._eval(v, env)]));
      case "BinaryExpr": return this._evalBinary(expr, env);
      case "UnaryExpr":  return this._evalUnary(expr, env);
      case "CallExpr":   return this._evalCall(expr, env);
      case "MemberExpr": return this._getMember(this._eval(expr.object, env), expr.property, expr.line);
      case "IndexExpr":  return this._getIndex(this._eval(expr.object, env), this._eval(expr.index, env), expr.line);
      case "AskExpr":    return this._askSync(expr.prompt);
      case "AwaitExpr":  return this._eval(expr.expr, env); // sync fallback
      default: throw new RuntimeError(`Unknown expression: ${expr.type}`, expr.line);
    }
  }

  _evalBinary(expr, env) {
    // Short-circuit logic first
    if (expr.op === "and") {
      const l = this._eval(expr.left, env);
      return this.isTruthy(l) ? this._eval(expr.right, env) : l;
    }
    if (expr.op === "or") {
      const l = this._eval(expr.left, env);
      return this.isTruthy(l) ? l : this._eval(expr.right, env);
    }

    const l = this._eval(expr.left,  env);
    const r = this._eval(expr.right, env);

    switch (expr.op) {
      case "+":
        if (l instanceof ElainaList && r instanceof ElainaList)
          return new ElainaList([...l.items, ...r.items]);
        if (typeof l === "string" || typeof r === "string")
          return elainaStr(l) + elainaStr(r);
        return l + r;
      case "-":  return l - r;
      case "*":
        if (typeof l === "string" && typeof r === "number") return l.repeat(r);
        if (l instanceof ElainaList && typeof r === "number")
          return new ElainaList(Array.from({ length: r }, () => l.items).flat());
        return l * r;
      case "/":
        if (r === 0) throw new RuntimeError("Division by zero", expr.line);
        return l / r;
      case "%":  return l % r;
      case "**": return l ** r;
      case "==": return l === r;
      case "!=": return l !== r;
      case "<":  return l < r;
      case ">":  return l > r;
      case "<=": return l <= r;
      case ">=": return l >= r;
      default: throw new RuntimeError(`Unknown operator: ${expr.op}`, expr.line);
    }
  }

  _evalUnary(expr, env) {
    const val = this._eval(expr.operand, env);
    if (expr.op === "not") return !this.isTruthy(val);
    if (expr.op === "-")   return -val;
    throw new RuntimeError(`Unknown unary: ${expr.op}`, expr.line);
  }

  _evalCall(expr, env) {
    const callee = this._eval(expr.callee, env);
    const args   = expr.args.map(a => this._eval(a, env));
    return this.callCallable(callee, args, expr.line);
  }

  // ── Callable dispatch ─────────────────────────────────────

  callCallable(callee, args, line = 0) {
    // Native built-in
    if (callee?.__builtin__) {
      return callee.call(args, this);
    }

    // User-defined spell
    if (callee?.__spell__) {
      const callEnv = callee.closure.child(`spell:${callee.name}`);
      callee.params.forEach((p, i) => callEnv.define(p, args[i] ?? null));
      const sig = this._execBlock(callee.body, callEnv);
      if (sig instanceof ReturnSignal) return sig.value;
      return null;
    }

    // Bound method (self + spell)
    if (callee instanceof BoundMethod) {
      const spell   = callee.spell;
      const callEnv = spell.closure.child(`method:${spell.name}`);
      callEnv.define("self", callee.instance);
      // strip "self" from params if declared
      const params = spell.params[0] === "self" ? spell.params.slice(1) : spell.params;
      params.forEach((p, i) => callEnv.define(p, args[i] ?? null));
      const sig = this._execBlock(spell.body, callEnv);
      if (sig instanceof ReturnSignal) return sig.value;
      return null;
    }

    // ElainaClass construction
    if (callee instanceof ElainaClass) {
      const instance = new ElainaInstance(callee);
      // Call init if defined
      let k = callee;
      while (k) {
        if ("init" in k.methods) {
          const initMethod = new BoundMethod(instance, k.methods["init"]);
          this.callCallable(initMethod, args, line);
          break;
        }
        k = k.parent ?? null;
      }
      return instance;
    }

    // Dict method (stdlib module)
    if (callee instanceof ElainaDict) {
      throw new RuntimeError(`'dict' is not callable — did you mean a method on it?`, line);
    }

    throw new RuntimeError(
      `'${elainaStr(callee)}' is not callable`,
      line
    );
  }

  // ── Member / index access ─────────────────────────────────

  _getMember(obj, prop, line) {
    if (obj instanceof ElainaInstance) return obj.get(prop, line);

    if (obj instanceof ElainaList) {
      // Native list methods
      const methods = {
        push:     (args) => { obj.push(args[0]); return obj; },
        pop:      ()     => obj.pop(),
        shift:    ()     => obj.shift(),
        includes: (args) => obj.includes(args[0]),
        indexOf:  (args) => obj.indexOf(args[0]),
        join:     (args) => obj.join(args[0]),
        reverse:  ()     => obj.reverse(),
        slice:    (args) => obj.slice(args[0], args[1]),
        sort:     ()     => obj.sort(),
        length:   null,  // not callable
      };
      if (prop === "length") return obj.items.length;
      if (prop in methods) {
        const fn = methods[prop];
        return { __builtin__: true, name: `list.${prop}`, call: fn };
      }
    }

    if (obj instanceof ElainaDict) {
      const val = obj.get(prop);
      if (val !== null) return val;
      // Dict built-in methods
      const methods = {
        get:    (args) => obj.get(args[0]),
        set:    (args) => { obj.set(args[0], args[1]); return null; },
        has:    (args) => obj.has(args[0]),
        keys:   ()     => obj.keys(),
        values: ()     => obj.values(),
        remove: (args) => { obj.remove(args[0]); return null; },
      };
      if (prop in methods) {
        return { __builtin__: true, name: `dict.${prop}`, call: methods[prop] };
      }
    }

    if (typeof obj === "string") {
      const methods = {
        upper:    ()     => obj.toUpperCase(),
        lower:    ()     => obj.toLowerCase(),
        trim:     ()     => obj.trim(),
        split:    (args) => new ElainaList(obj.split(args[0] ?? "")),
        replace:  (args) => obj.split(args[0]).join(args[1]),
        includes: (args) => obj.includes(args[0]),
        startsWith:(args)=> obj.startsWith(args[0]),
        endsWith: (args) => obj.endsWith(args[0]),
        length:   null,
      };
      if (prop === "length") return obj.length;
      if (prop in methods) {
        return { __builtin__: true, name: `str.${prop}`, call: methods[prop] };
      }
    }

    throw new RuntimeError(`'${elainaStr(obj)}' has no property '${prop}'`, line);
  }

  _setMember(obj, prop, value, line) {
    if (obj instanceof ElainaInstance) { obj.set(prop, value); return; }
    if (obj instanceof ElainaDict)     { obj.set(prop, value); return; }
    throw new RuntimeError(`Cannot set property '${prop}' on ${elainaStr(obj)}`, line);
  }

  _getIndex(obj, idx, line) {
    if (obj instanceof ElainaList) return obj.get(idx) ?? null;
    if (obj instanceof ElainaDict) return obj.get(idx);
    if (typeof obj === "string") {
      const i = idx < 0 ? obj.length + idx : idx;
      return obj[i] ?? null;
    }
    throw new RuntimeError(`'${elainaStr(obj)}' is not subscriptable`, line);
  }

  _setIndex(obj, idx, value, line) {
    if (obj instanceof ElainaList) { obj.set(idx, value); return; }
    if (obj instanceof ElainaDict) { obj.set(idx, value); return; }
    throw new RuntimeError(`Cannot index-assign into '${elainaStr(obj)}'`, line);
  }

  // ── Helpers ───────────────────────────────────────────────

  isTruthy(val) {
    if (val === null || val === false || val === 0 || val === "") return false;
    if (val instanceof ElainaList) return val.items.length > 0;
    return true;
  }

  _toIterable(val, line) {
    if (val instanceof ElainaList) return val.items;
    if (typeof val === "string")   return val.split("");
    if (val instanceof ElainaDict) return Object.keys(val.data);
    throw new RuntimeError(`'${elainaStr(val)}' is not iterable`, line);
  }

  _askSync(prompt) {
    // Synchronous prompt — works in Node via execFileSync trick
    // Falls back to a no-op if not in terminal context
    if (this.inputFn) {
      // Caller provides sync input fn (e.g. tests)
      return this.inputFn(prompt) ?? "";
    }
    // Try native readline sync
    try {
      const { execFileSync } = require("child_process");
      process.stdout.write(prompt + " ");
      const result = execFileSync("bash", ["-c", "read line && echo $line"], { stdio: ["inherit", "pipe", "inherit"] });
      return result.toString().trim();
    } catch {
      return "";
    }
  }
}

module.exports = { Interpreter };
