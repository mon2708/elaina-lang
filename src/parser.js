"use strict";

// ════════════════════════════════════════════════════════════
//  ELAINA v3 — PARSER
//  Recursive descent parser. Produces a typed AST from the
//  token stream emitted by the Lexer.
//
//  Operator precedence (lowest → highest):
//    or → and → not → equality → comparison →
//    add/sub → mul/div/mod → exponent → unary → postfix → primary
// ════════════════════════════════════════════════════════════

const { T } = require("./lexer");

// ── AST node factories (tagged plain objects for readability) ──

// Statements
const n = {
  Program:    (body)                              => ({ type: "Program",    body }),
  SayStmt:    (expr, line)                        => ({ type: "SayStmt",    expr, line }),
  LetStmt:    (name, value, line)                 => ({ type: "LetStmt",    name, value, line }),
  AssignStmt: (target, op, value, line)           => ({ type: "AssignStmt", target, op, value, line }),
  IfStmt:     (branches, elseBlock, line)         => ({ type: "IfStmt",     branches, elseBlock, line }),
  LoopRangeStmt: (v, from, to, body, line)        => ({ type: "LoopRangeStmt", varName: v, from, to, body, line }),
  LoopInStmt: (v, iterable, body, line)           => ({ type: "LoopInStmt", varName: v, iterable, body, line }),
  WhileStmt:  (cond, body, line)                  => ({ type: "WhileStmt",  cond, body, line }),
  BreakStmt:  (line)                              => ({ type: "BreakStmt",  line }),
  ContinueStmt:(line)                             => ({ type: "ContinueStmt", line }),
  SpellStmt:  (name, params, body, isAsync, line) => ({ type: "SpellStmt",  name, params, body, isAsync, line }),
  ReturnStmt: (value, line)                       => ({ type: "ReturnStmt", value, line }),
  CastStmt:   (expr, line)                        => ({ type: "CastStmt",   expr, line }),
  EnchantStmt:(name, parent, methods, line)       => ({ type: "EnchantStmt",name, parent, methods, line }),
  ImportStmt: (path, alias, line)                 => ({ type: "ImportStmt", path, alias, line }),
  TryCatch:   (tryBlock, errName, catchBlock, line)=>({ type: "TryCatch",   tryBlock, errName, catchBlock, line }),
  RaiseStmt:  (expr, line)                        => ({ type: "RaiseStmt",  expr, line }),
  SummonStmt: (prompt, target, line)              => ({ type: "SummonStmt", prompt, target, line }),
  ExprStmt:   (expr, line)                        => ({ type: "ExprStmt",   expr, line }),

  // Expressions
  NumberLit:  (v, line)                     => ({ type: "NumberLit",  value: v, line }),
  StringLit:  (v, line)                     => ({ type: "StringLit",  value: v, line }),
  BoolLit:    (v, line)                     => ({ type: "BoolLit",    value: v, line }),
  NullLit:    (line)                        => ({ type: "NullLit",    line }),
  ListLit:    (elems, line)                 => ({ type: "ListLit",    elements: elems, line }),
  DictLit:    (pairs, line)                 => ({ type: "DictLit",    pairs, line }),
  Identifier: (name, line)                  => ({ type: "Identifier", name, line }),
  BinaryExpr: (op, left, right, line)       => ({ type: "BinaryExpr", op, left, right, line }),
  UnaryExpr:  (op, operand, line)           => ({ type: "UnaryExpr",  op, operand, line }),
  CallExpr:   (callee, args, line)          => ({ type: "CallExpr",   callee, args, line }),
  IndexExpr:  (obj, index, line)            => ({ type: "IndexExpr",  object: obj, index, line }),
  MemberExpr: (obj, prop, line)             => ({ type: "MemberExpr", object: obj, property: prop, line }),
  AwaitExpr:  (expr, line)                  => ({ type: "AwaitExpr",  expr, line }),
  AskExpr:    (prompt, line)                => ({ type: "AskExpr",    prompt, line }),
};

class ParseError extends Error {
  constructor(msg, line, col) {
    super(`[Parser] Line ${line} — ${msg}`);
    this.line = line; this.col = col;
  }
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos    = 0;
  }

  // ── Token utilities ──────────────────────────────────────

  cur()            { return this.tokens[this.pos]; }
  peek(off = 1)    { return this.tokens[Math.min(this.pos + off, this.tokens.length - 1)]; }
  line()           { return this.cur().line; }

  advance() {
    const t = this.tokens[this.pos];
    if (t.type !== T.EOF) this.pos++;
    return t;
  }

  check(type)      { return this.cur().type === type; }
  checkAny(...tt)  { return tt.includes(this.cur().type); }

  match(type) {
    if (this.check(type)) { this.advance(); return true; }
    return false;
  }

  expect(type, hint = "") {
    if (!this.check(type)) {
      const t = this.cur();
      throw new ParseError(
        `Expected ${type}${hint ? " (" + hint + ")" : ""}, got ${t.type}${t.value != null ? " '" + t.value + "'" : ""}`,
        t.line, t.col
      );
    }
    return this.advance();
  }

  skipNewlines() {
    while (this.check(T.NEWLINE)) this.advance();
  }

  // ── Top-level ─────────────────────────────────────────────

  parse() {
    const stmts = [];
    this.skipNewlines();
    while (!this.check(T.EOF)) {
      stmts.push(this.parseStatement());
      this.skipNewlines();
    }
    return n.Program(stmts);
  }

  parseBlock() {
    this.expect(T.INDENT, "expected indented block");
    this.skipNewlines();
    const stmts = [];
    while (!this.check(T.DEDENT) && !this.check(T.EOF)) {
      stmts.push(this.parseStatement());
      this.skipNewlines();
    }
    if (this.check(T.DEDENT)) this.advance();
    return stmts;
  }

  // ── Statements ────────────────────────────────────────────

  parseStatement() {
    this.skipNewlines();
    const t = this.cur();

    if (t.type === T.SAY)     return this.parseSay();
    if (t.type === T.LET)     return this.parseLet();
    if (t.type === T.IF)      return this.parseIf();
    if (t.type === T.LOOP)    return this.parseLoop();
    if (t.type === T.WHILE)   return this.parseWhile();
    if (t.type === T.BREAK)   { this.advance(); this.skipNewlines(); return n.BreakStmt(t.line); }
    if (t.type === T.CONTINUE){ this.advance(); this.skipNewlines(); return n.ContinueStmt(t.line); }
    if (t.type === T.SPELL || t.type === T.ASYNC) return this.parseSpell();
    if (t.type === T.ENCHANT) return this.parseEnchant();
    if (t.type === T.CAST)    return this.parseCastStmt();
    if (t.type === T.GIVE)    return this.parseReturn();
    if (t.type === T.IMPORT)  return this.parseImport();
    if (t.type === T.TRY)     return this.parseTryCatch();
    if (t.type === T.RAISE)   return this.parseRaise();
    if (t.type === T.SUMMON)  return this.parseSummon();

    // Assignment or expression statement
    return this.parseAssignOrExpr();
  }

  parseSay() {
    const line = this.line();
    this.expect(T.SAY);
    const expr = this.parseExpression();
    this.skipNewlines();
    return n.SayStmt(expr, line);
  }

  parseLet() {
    const line = this.line();
    this.expect(T.LET);
    const name = this.expect(T.IDENTIFIER, "variable name").value;
    this.expect(T.ASSIGN);
    const value = this.parseExpression();
    this.skipNewlines();
    return n.LetStmt(name, value, line);
  }

  parseAssignOrExpr() {
    const line = this.line();
    const expr  = this.parseExpression();

    // Augmented / regular assignment
    if (this.checkAny(T.ASSIGN, T.PLUS_ASSIGN, T.MINUS_ASSIGN)) {
      const op = this.advance().value;
      const val = this.parseExpression();
      this.skipNewlines();
      return n.AssignStmt(expr, op, val, line);
    }

    this.skipNewlines();
    return n.ExprStmt(expr, line);
  }

  parseIf() {
    const line = this.line();
    this.expect(T.IF);
    const branches = [];

    const cond  = this.parseExpression();
    this.expect(T.COLON);
    this.skipNewlines();
    const block = this.parseBlock();
    branches.push({ cond, block });

    this.skipNewlines();
    while (this.check(T.ELIF)) {
      this.advance();
      const c = this.parseExpression();
      this.expect(T.COLON);
      this.skipNewlines();
      branches.push({ cond: c, block: this.parseBlock() });
      this.skipNewlines();
    }

    let elseBlock = null;
    if (this.check(T.ELSE)) {
      this.advance();
      this.expect(T.COLON);
      this.skipNewlines();
      elseBlock = this.parseBlock();
    }

    return n.IfStmt(branches, elseBlock, line);
  }

  parseLoop() {
    const line = this.line();
    this.expect(T.LOOP);
    const varName = this.expect(T.IDENTIFIER, "loop variable").value;

    if (this.check(T.FROM)) {
      this.advance();
      const from = this.parseExpression();
      this.expect(T.TO);
      const to = this.parseExpression();
      this.expect(T.COLON);
      this.skipNewlines();
      return n.LoopRangeStmt(varName, from, to, this.parseBlock(), line);
    }

    if (this.check(T.IN)) {
      this.advance();
      const iter = this.parseExpression();
      this.expect(T.COLON);
      this.skipNewlines();
      return n.LoopInStmt(varName, iter, this.parseBlock(), line);
    }

    throw new ParseError("Expected 'from' or 'in' after loop variable", line, 0);
  }

  parseWhile() {
    const line = this.line();
    this.expect(T.WHILE);
    const cond = this.parseExpression();
    this.expect(T.COLON);
    this.skipNewlines();
    return n.WhileStmt(cond, this.parseBlock(), line);
  }

  parseSpell() {
    const line = this.line();
    const isAsync = this.check(T.ASYNC);
    if (isAsync) this.advance();
    this.expect(T.SPELL);
    const name = this.expect(T.IDENTIFIER, "spell name").value;
    this.expect(T.LPAREN);
    const params = this._parseParamList();
    this.expect(T.RPAREN);
    this.expect(T.COLON);
    this.skipNewlines();
    return n.SpellStmt(name, params, this.parseBlock(), isAsync, line);
  }

  _parseParamList() {
    const params = [];
    if (this.check(T.RPAREN)) return params;
    params.push(this.expect(T.IDENTIFIER, "parameter name").value);
    while (this.check(T.COMMA)) {
      this.advance();
      params.push(this.expect(T.IDENTIFIER, "parameter name").value);
    }
    return params;
  }

  parseEnchant() {
    const line = this.line();
    this.expect(T.ENCHANT);
    const name = this.expect(T.IDENTIFIER, "class name").value;

    // Optional parent: enchant Hero from Character:
    let parent = null;
    if (this.check(T.FROM)) {
      this.advance();
      parent = this.expect(T.IDENTIFIER, "parent class").value;
    }

    this.expect(T.COLON);
    this.skipNewlines();
    this.expect(T.INDENT);
    this.skipNewlines();

    const methods = [];
    while (!this.check(T.DEDENT) && !this.check(T.EOF)) {
      if (this.check(T.SPELL) || this.check(T.ASYNC)) {
        methods.push(this.parseSpell());
      } else {
        this.skipNewlines();
        if (!this.check(T.DEDENT)) {
          throw new ParseError("Expected 'spell' inside enchant block", this.line(), 0);
        }
      }
      this.skipNewlines();
    }
    if (this.check(T.DEDENT)) this.advance();

    return n.EnchantStmt(name, parent, methods, line);
  }

  parseCastStmt() {
    const line = this.line();
    this.expect(T.CAST);
    const expr = this.parsePostfix(this.parsePrimary());
    this.skipNewlines();
    return n.CastStmt(expr, line);
  }

  parseReturn() {
    const line = this.line();
    this.expect(T.GIVE);
    this.expect(T.BACK);
    const val = this.parseExpression();
    this.skipNewlines();
    return n.ReturnStmt(val, line);
  }

  parseImport() {
    const line = this.line();
    this.expect(T.IMPORT);
    const path = this.expect(T.STRING, "module path").value;
    let alias = null;
    if (this.check(T.AS)) {
      this.advance();
      alias = this.expect(T.IDENTIFIER, "alias name").value;
    }
    this.skipNewlines();
    return n.ImportStmt(path, alias, line);
  }

  parseTryCatch() {
    const line = this.line();
    this.expect(T.TRY);
    this.expect(T.COLON);
    this.skipNewlines();
    const tryBlock = this.parseBlock();
    this.skipNewlines();
    this.expect(T.CATCH);
    const errName = this.expect(T.IDENTIFIER, "error variable").value;
    this.expect(T.COLON);
    this.skipNewlines();
    return n.TryCatch(tryBlock, errName, this.parseBlock(), line);
  }

  parseRaise() {
    const line = this.line();
    this.expect(T.RAISE);
    const expr = this.parseExpression();
    this.skipNewlines();
    return n.RaiseStmt(expr, line);
  }

  parseSummon() {
    const line = this.line();
    this.expect(T.SUMMON);
    const prompt = this.expect(T.STRING, "summon prompt").value;
    let target = null;
    if (this.check(T.AS)) {
      this.advance();
      target = this.expect(T.IDENTIFIER).value;
    }
    this.skipNewlines();
    return n.SummonStmt(prompt, target, line);
  }

  // ── Expressions (precedence climbing) ────────────────────

  parseExpression() { return this.parseOr(); }

  parseOr() {
    let left = this.parseAnd();
    while (this.check(T.OR)) {
      const line = this.line(); this.advance();
      left = n.BinaryExpr("or", left, this.parseAnd(), line);
    }
    return left;
  }

  parseAnd() {
    let left = this.parseNot();
    while (this.check(T.AND)) {
      const line = this.line(); this.advance();
      left = n.BinaryExpr("and", left, this.parseNot(), line);
    }
    return left;
  }

  parseNot() {
    if (this.check(T.NOT)) {
      const line = this.line(); this.advance();
      return n.UnaryExpr("not", this.parseNot(), line);
    }
    return this.parseEquality();
  }

  parseEquality() {
    let left = this.parseComparison();
    while (this.checkAny(T.EQ, T.NEQ)) {
      const line = this.line();
      const op = this.advance().value;
      left = n.BinaryExpr(op, left, this.parseComparison(), line);
    }
    return left;
  }

  parseComparison() {
    let left = this.parseAddSub();
    while (this.checkAny(T.LT, T.GT, T.LTE, T.GTE)) {
      const line = this.line();
      const op = this.advance().value;
      left = n.BinaryExpr(op, left, this.parseAddSub(), line);
    }
    return left;
  }

  parseAddSub() {
    let left = this.parseMulDiv();
    while (this.checkAny(T.PLUS, T.MINUS)) {
      const line = this.line();
      const op = this.advance().value;
      left = n.BinaryExpr(op, left, this.parseMulDiv(), line);
    }
    return left;
  }

  parseMulDiv() {
    let left = this.parseExponent();
    while (this.checkAny(T.STAR, T.SLASH, T.PERCENT)) {
      const line = this.line();
      const op = this.advance().value;
      left = n.BinaryExpr(op, left, this.parseExponent(), line);
    }
    return left;
  }

  parseExponent() {
    let left = this.parseUnaryMinus();
    if (this.check(T.STARSTAR)) {
      const line = this.line(); this.advance();
      // right-associative
      return n.BinaryExpr("**", left, this.parseExponent(), line);
    }
    return left;
  }

  parseUnaryMinus() {
    if (this.check(T.MINUS)) {
      const line = this.line(); this.advance();
      return n.UnaryExpr("-", this.parseUnaryMinus(), line);
    }
    return this.parsePostfixStart();
  }

  parsePostfixStart() {
    return this.parsePostfix(this.parsePrimary());
  }

  parsePostfix(left) {
    while (true) {
      if (this.check(T.DOT)) {
        const line = this.line(); this.advance();
        const prop = this.expect(T.IDENTIFIER, "property name").value;

        if (this.check(T.LPAREN)) {
          this.advance();
          const args = this._parseArgList();
          this.expect(T.RPAREN);
          left = n.CallExpr(n.MemberExpr(left, prop, line), args, line);
        } else {
          left = n.MemberExpr(left, prop, line);
        }
        continue;
      }

      if (this.check(T.LBRACKET)) {
        const line = this.line(); this.advance();
        const idx = this.parseExpression();
        this.expect(T.RBRACKET);
        left = n.IndexExpr(left, idx, line);
        continue;
      }

      if (this.check(T.LPAREN)) {
        const line = this.line(); this.advance();
        const args = this._parseArgList();
        this.expect(T.RPAREN);
        left = n.CallExpr(left, args, line);
        continue;
      }

      break;
    }
    return left;
  }

  parsePrimary() {
    const t    = this.cur();
    const line = t.line;

    if (t.type === T.NUMBER)  { this.advance(); return n.NumberLit(t.value, line); }
    if (t.type === T.STRING)  { this.advance(); return n.StringLit(t.value, line); }
    if (t.type === T.BOOLEAN) { this.advance(); return n.BoolLit(t.value, line); }
    if (t.type === T.NULL)    { this.advance(); return n.NullLit(line); }

    if (t.type === T.SELF) {
      this.advance();
      return n.Identifier("self", line);
    }

    if (t.type === T.ASK) {
      this.advance();
      const prompt = this.check(T.STRING) ? this.advance().value : "";
      return n.AskExpr(prompt, line);
    }

    if (t.type === T.AWAIT) {
      this.advance();
      return n.AwaitExpr(this.parseExpression(), line);
    }

    // Parenthesised expression
    if (t.type === T.LPAREN) {
      this.advance();
      const expr = this.parseExpression();
      this.expect(T.RPAREN);
      return expr;
    }

    // List literal
    if (t.type === T.LBRACKET) {
      this.advance();
      this.skipNewlines();
      const elems = [];
      if (!this.check(T.RBRACKET)) {
        elems.push(this.parseExpression());
        while (this.check(T.COMMA)) {
          this.advance(); this.skipNewlines();
          if (this.check(T.RBRACKET)) break;
          elems.push(this.parseExpression());
        }
      }
      this.skipNewlines();
      this.expect(T.RBRACKET);
      return n.ListLit(elems, line);
    }

    // Dict literal  { "key": value, ... }
    if (t.type === T.LBRACE) {
      this.advance();
      this.skipNewlines();
      const pairs = [];
      if (!this.check(T.RBRACE)) {
        const k = this.parseExpression();
        this.expect(T.COLON);
        const v = this.parseExpression();
        pairs.push([k, v]);
        while (this.check(T.COMMA)) {
          this.advance(); this.skipNewlines();
          if (this.check(T.RBRACE)) break;
          const k2 = this.parseExpression();
          this.expect(T.COLON);
          pairs.push([k2, this.parseExpression()]);
        }
      }
      this.skipNewlines();
      this.expect(T.RBRACE);
      return n.DictLit(pairs, line);
    }

    // Identifier (plain or function call handled in postfix)
    if (t.type === T.IDENTIFIER) {
      this.advance();
      return n.Identifier(t.value, line);
    }

    throw new ParseError(
      `Unexpected token ${t.type}${t.value != null ? " '" + t.value + "'" : ""}`,
      t.line, t.col ?? 0
    );
  }

  _parseArgList() {
    const args = [];
    this.skipNewlines();
    if (this.check(T.RPAREN)) return args;
    args.push(this.parseExpression());
    while (this.check(T.COMMA)) {
      this.advance(); this.skipNewlines();
      if (this.check(T.RPAREN)) break;
      args.push(this.parseExpression());
    }
    this.skipNewlines();
    return args;
  }
}

module.exports = { Parser, ParseError };
