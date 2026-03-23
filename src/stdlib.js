"use strict";

// ════════════════════════════════════════════════════════════
//  ELAINA v3 — STANDARD LIBRARY
//  All built-in modules and global functions.
//  Each module is a plain JS object. Functions are native
//  callbacks that receive (args, interpreter) for full access.
// ════════════════════════════════════════════════════════════

const fs   = require("fs");
const path = require("path");

// ── ElainaList: list type with native methods ─────────────

class ElainaList {
  constructor(items = []) { this.items = [...items]; }

  get length() { return this.items.length; }

  // Instance methods (callable as myList.push(x))
  push(x)         { this.items.push(x); return this; }
  pop()           { return this.items.pop() ?? null; }
  shift()         { return this.items.shift() ?? null; }
  includes(x)     { return this.items.includes(x); }
  indexOf(x)      { return this.items.indexOf(x); }
  join(sep = ",") { return this.items.join(sep); }
  reverse()       { return new ElainaList([...this.items].reverse()); }
  slice(a, b)     { return new ElainaList(this.items.slice(a, b)); }
  sort()          { return new ElainaList([...this.items].sort((a, b) => a > b ? 1 : -1)); }

  get(i) {
    const idx = i < 0 ? this.items.length + i : i;
    return this.items[idx] ?? null;
  }
  set(i, v) {
    const idx = i < 0 ? this.items.length + i : i;
    this.items[idx] = v;
  }

  toString() { return "[" + this.items.map(elainaStr).join(", ") + "]"; }
  [Symbol.iterator]() { return this.items[Symbol.iterator](); }
}

// ── ElainaDict: dict/object type ──────────────────────────

class ElainaDict {
  constructor(pairs = []) {
    this.data = Object.create(null);
    for (const [k, v] of pairs) this.data[String(k)] = v;
  }

  get(k)      { return this.data[String(k)] ?? null; }
  set(k, v)   { this.data[String(k)] = v; }
  has(k)      { return String(k) in this.data; }
  keys()      { return new ElainaList(Object.keys(this.data)); }
  values()    { return new ElainaList(Object.values(this.data)); }
  remove(k)   { delete this.data[String(k)]; }
  toString()  {
    const pairs = Object.entries(this.data).map(([k, v]) => `"${k}": ${elainaStr(v)}`);
    return "{" + pairs.join(", ") + "}";
  }
}

// ── ElainaInstance: runtime class instance ────────────────

class ElainaInstance {
  constructor(klass) {
    this.klass  = klass;
    this.fields = Object.create(null);
  }

  get(name, line) {
    if (name in this.fields) return this.fields[name];

    // Walk the class hierarchy for methods
    let k = this.klass;
    while (k) {
      if (name in k.methods) {
        const method = k.methods[name];
        // Return a bound method (closure over self)
        return new BoundMethod(this, method);
      }
      k = k.parent ?? null;
    }
    throw new Error(`'${this.klass.name}' has no attribute '${name}'`);
  }

  set(name, value) { this.fields[name] = value; }
  toString()       { return `<${this.klass.name} instance>`; }
}

class ElainaClass {
  constructor(name, parent, methods) {
    this.name    = name;
    this.parent  = parent;   // ElainaClass | null
    this.methods = methods;  // { name: SpellNode }
  }
  toString() { return `<class ${this.name}>`; }
}

class BoundMethod {
  constructor(instance, spell) {
    this.instance = instance;
    this.spell    = spell;
  }
  toString() { return `<bound method ${this.spell.name}>`; }
}

// ── Stringify helper (used everywhere) ────────────────────

function elainaStr(val) {
  if (val === null || val === undefined) return "nothing";
  if (val === true)  return "true";
  if (val === false) return "false";
  if (val instanceof ElainaList)     return val.toString();
  if (val instanceof ElainaDict)     return val.toString();
  if (val instanceof ElainaInstance) return val.toString();
  if (val instanceof ElainaClass)    return val.toString();
  if (val instanceof BoundMethod)    return val.toString();
  return String(val);
}

// ── Standard library modules ──────────────────────────────

const STDLIB = {

  // ── math ─────────────────────────────────────────────────
  math: {
    PI:     Math.PI,
    E:      Math.E,
    sqrt:   ([x])    => Math.sqrt(x),
    pow:    ([x, y]) => Math.pow(x, y),
    abs:    ([x])    => Math.abs(x),
    floor:  ([x])    => Math.floor(x),
    ceil:   ([x])    => Math.ceil(x),
    round:  ([x])    => Math.round(x),
    log:    ([x])    => Math.log(x),
    log2:   ([x])    => Math.log2(x),
    log10:  ([x])    => Math.log10(x),
    sin:    ([x])    => Math.sin(x),
    cos:    ([x])    => Math.cos(x),
    tan:    ([x])    => Math.tan(x),
    max:    (args)   => Math.max(...args),
    min:    (args)   => Math.min(...args),
    random: ()       => Math.random(),
    randint:([a, b]) => Math.floor(Math.random() * (b - a + 1)) + a,
    clamp:  ([v, lo, hi]) => Math.max(lo, Math.min(hi, v)),
  },

  // ── string ───────────────────────────────────────────────
  string: {
    upper:    ([s])       => String(s).toUpperCase(),
    lower:    ([s])       => String(s).toLowerCase(),
    trim:     ([s])       => String(s).trim(),
    split:    ([s, sep])  => new ElainaList(String(s).split(sep ?? "")),
    replace:  ([s, a, b]) => String(s).split(a).join(b),
    contains: ([s, sub])  => String(s).includes(sub),
    startsWith:([s, p])   => String(s).startsWith(p),
    endsWith: ([s, p])    => String(s).endsWith(p),
    repeat:   ([s, n])    => String(s).repeat(n),
    len:      ([s])       => String(s).length,
    charAt:   ([s, i])    => String(s)[i] ?? null,
    slice:    ([s, a, b]) => String(s).slice(a, b),
    format:   ([tmpl, ...vals]) => {
      let result = String(tmpl);
      for (const v of vals) result = result.replace("{}", elainaStr(v));
      return result;
    },
  },

  // ── list helpers ─────────────────────────────────────────
  list: {
    make:    ([n, fill]) => new ElainaList(Array(n).fill(fill ?? null)),
    range:   ([a, b])    => new ElainaList(Array.from({ length: b - a + 1 }, (_, i) => a + i)),
    concat:  ([a, b])    => new ElainaList([...a.items, ...b.items]),
    flat:    ([lst])     => new ElainaList(lst.items.flat()),
    map:     ([lst, fn], interp) => {
      const results = lst.items.map(item => interp.callCallable(fn, [item]));
      return new ElainaList(results);
    },
    filter:  ([lst, fn], interp) => {
      const results = lst.items.filter(item => interp.isTruthy(interp.callCallable(fn, [item])));
      return new ElainaList(results);
    },
    reduce:  ([lst, fn, init], interp) => {
      return lst.items.reduce((acc, item) => interp.callCallable(fn, [acc, item]), init);
    },
    sum:     ([lst]) => lst.items.reduce((a, b) => a + b, 0),
    zip:     ([a, b]) => new ElainaList(
      a.items.map((item, i) => new ElainaList([item, b.items[i] ?? null]))
    ),
    enumerate: ([lst]) => new ElainaList(
      lst.items.map((item, i) => new ElainaList([i, item]))
    ),
  },

  // ── io ───────────────────────────────────────────────────
  io: {
    readFile:  ([p])    => { try { return fs.readFileSync(p, "utf8"); } catch { return null; } },
    writeFile: ([p, c]) => { try { fs.writeFileSync(p, c, "utf8"); return true; } catch { return false; } },
    appendFile:([p, c]) => { try { fs.appendFileSync(p, c, "utf8"); return true; } catch { return false; } },
    exists:    ([p])    => fs.existsSync(p),
    listDir:   ([p])    => { try { return new ElainaList(fs.readdirSync(p)); } catch { return new ElainaList(); } },
    cwd:       ()       => process.cwd(),
    joinPath:  (args)   => path.join(...args),
  },

  // ── system ───────────────────────────────────────────────
  system: {
    exit:    ([code]) => process.exit(code ?? 0),
    env:     ([key])  => process.env[key] ?? null,
    args:    ()       => new ElainaList(process.argv.slice(2)),
    now:     ()       => Date.now(),
    time:    ()       => new Date().toISOString(),
  },
};

// ── Global built-in functions (always in scope) ───────────

function buildGlobals(env, outputFn) {
  const define = (name, fn) => env.define(name, { __builtin__: true, name, call: fn });

  define("print",   (args) => { outputFn(args.map(elainaStr).join(" ")); return null; });
  define("str",     ([x])  => elainaStr(x));
  define("num",     ([x])  => {
    const n = parseFloat(x);
    return isNaN(n) ? null : n;
  });
  define("bool",    ([x], interp) => interp.isTruthy(x));
  define("type",    ([x])  => {
    if (x === null)              return "nothing";
    if (typeof x === "boolean")  return "boolean";
    if (typeof x === "number")   return "number";
    if (typeof x === "string")   return "string";
    if (x instanceof ElainaList) return "list";
    if (x instanceof ElainaDict) return "dict";
    if (x instanceof ElainaInstance) return x.klass.name;
    if (x instanceof ElainaClass)    return "class";
    return "unknown";
  });
  define("len",     ([x])  => {
    if (typeof x === "string")   return x.length;
    if (x instanceof ElainaList) return x.items.length;
    if (x instanceof ElainaDict) return Object.keys(x.data).length;
    return 0;
  });
  define("range",   ([a, b]) => new ElainaList(Array.from({ length: b - a + 1 }, (_, i) => a + i)));
  define("list",    ([x])  => {
    if (x instanceof ElainaList) return x;
    if (typeof x === "string")   return new ElainaList(x.split(""));
    return new ElainaList([x]);
  });
  define("dict",    ()     => new ElainaDict());
  define("keys",    ([d])  => d instanceof ElainaDict ? d.keys() : new ElainaList());
  define("values",  ([d])  => d instanceof ElainaDict ? d.values() : new ElainaList());
  define("sqrt",    ([x])  => Math.sqrt(x));
  define("abs",     ([x])  => Math.abs(x));
  define("floor",   ([x])  => Math.floor(x));
  define("ceil",    ([x])  => Math.ceil(x));
  define("round",   ([x])  => Math.round(x));
  define("pow",     ([x, y]) => Math.pow(x, y));
  define("max",     (args) => Math.max(...args));
  define("min",     (args) => Math.min(...args));
  define("random",  ()     => Math.random());
  define("randint", ([a, b]) => Math.floor(Math.random() * (b - a + 1)) + a);
  define("upper",   ([s])  => String(s).toUpperCase());
  define("lower",   ([s])  => String(s).toLowerCase());
  define("trim",    ([s])  => String(s).trim());
  define("split",   ([s, sep]) => new ElainaList(String(s).split(sep ?? " ")));
  define("join",    ([lst, sep]) => lst.items.join(sep ?? ""));
  define("contains",([s, sub]) => String(s).includes(sub));
  define("format",  ([tmpl, ...vals]) => {
    let r = String(tmpl);
    for (const v of vals) r = r.replace("{}", elainaStr(v));
    return r;
  });

  // Math constants
  env.define("PI", Math.PI);
  env.define("E",  Math.E);
  env.define("nothing", null);
  env.define("true",    true);
  env.define("false",   false);
}

module.exports = {
  STDLIB,
  buildGlobals,
  ElainaList,
  ElainaDict,
  ElainaInstance,
  ElainaClass,
  BoundMethod,
  elainaStr,
};
