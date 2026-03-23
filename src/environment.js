"use strict";

// ════════════════════════════════════════════════════════════
//  ELAINA v3 — ENVIRONMENT
//  Lexical scope chain. Each block, function, and class gets
//  its own Environment with a pointer to its parent.
// ════════════════════════════════════════════════════════════

class RuntimeError extends Error {
  constructor(msg, line) {
    super(msg);
    this.name = "RuntimeError";
    this.elaLine = line;
  }
}

class ReturnSignal {
  constructor(value) { this.value = value; }
}

class BreakSignal    {}
class ContinueSignal {}

class Environment {
  constructor(parent = null, name = "<scope>") {
    this.vars   = Object.create(null);
    this.parent = parent;
    this.name   = name;
  }

  // Get — walk up the chain
  get(name, line) {
    if (name in this.vars) return this.vars[name];
    if (this.parent)       return this.parent.get(name, line);
    throw new RuntimeError(`'${name}' is not defined`, line);
  }

  // Set — walk up to find existing binding; create locally if not found
  set(name, value, line) {
    if (name in this.vars)           { this.vars[name] = value; return; }
    if (this.parent?.has(name))      { this.parent.set(name, value, line); return; }
    this.vars[name] = value;          // new local
  }

  // Define — always creates in current scope (used for params, loop vars)
  define(name, value) {
    this.vars[name] = value;
  }

  has(name) {
    if (name in this.vars) return true;
    return this.parent ? this.parent.has(name) : false;
  }

  child(name) {
    return new Environment(this, name);
  }
}

module.exports = { Environment, RuntimeError, ReturnSignal, BreakSignal, ContinueSignal };
