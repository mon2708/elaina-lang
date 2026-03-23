"use strict";

// ════════════════════════════════════════════════════════════
//  ELAINA v3 — LEXER
//  Converts raw source text into a structured token stream.
//  Handles: indentation (INDENT/DEDENT), strings, numbers,
//  keywords, operators, and bracket-aware newline suppression.
// ════════════════════════════════════════════════════════════

const T = {
  // ── Literals ──────────────────────────────────────────────
  NUMBER:     "NUMBER",
  STRING:     "STRING",
  BOOLEAN:    "BOOLEAN",
  NULL:       "NULL",
  IDENTIFIER: "IDENTIFIER",

  // ── Keywords ──────────────────────────────────────────────
  LET:        "LET",
  SAY:        "SAY",
  ASK:        "ASK",
  IF:         "IF",
  ELSE:       "ELSE",
  ELIF:       "ELIF",
  LOOP:       "LOOP",
  FROM:       "FROM",
  TO:         "TO",
  IN:         "IN",
  WHILE:      "WHILE",
  BREAK:      "BREAK",
  CONTINUE:   "CONTINUE",
  SPELL:      "SPELL",
  CAST:       "CAST",
  GIVE:       "GIVE",
  BACK:       "BACK",
  ENCHANT:    "ENCHANT",
  SELF:       "SELF",
  IMPORT:     "IMPORT",
  AS:         "AS",
  TRY:        "TRY",
  CATCH:      "CATCH",
  RAISE:      "RAISE",
  SUMMON:     "SUMMON",
  ASYNC:      "ASYNC",
  AWAIT:      "AWAIT",
  AND:        "AND",
  OR:         "OR",
  NOT:        "NOT",
  NOTHING:    "NOTHING",

  // ── Operators ─────────────────────────────────────────────
  PLUS:       "PLUS",
  MINUS:      "MINUS",
  STAR:       "STAR",
  SLASH:      "SLASH",
  PERCENT:    "PERCENT",
  STARSTAR:   "STARSTAR",
  ASSIGN:     "ASSIGN",
  PLUS_ASSIGN:"PLUS_ASSIGN",
  MINUS_ASSIGN:"MINUS_ASSIGN",
  EQ:         "EQ",
  NEQ:        "NEQ",
  LT:         "LT",
  GT:         "GT",
  LTE:        "LTE",
  GTE:        "GTE",
  DOT:        "DOT",

  // ── Delimiters ────────────────────────────────────────────
  LPAREN:     "LPAREN",
  RPAREN:     "RPAREN",
  LBRACKET:   "LBRACKET",
  RBRACKET:   "RBRACKET",
  LBRACE:     "LBRACE",
  RBRACE:     "RBRACE",
  COMMA:      "COMMA",
  COLON:      "COLON",

  // ── Structure ─────────────────────────────────────────────
  NEWLINE:    "NEWLINE",
  INDENT:     "INDENT",
  DEDENT:     "DEDENT",
  EOF:        "EOF",
};

const KEYWORDS = {
  let:      T.LET,
  say:      T.SAY,
  ask:      T.ASK,
  if:       T.IF,
  else:     T.ELSE,
  elif:     T.ELIF,
  loop:     T.LOOP,
  from:     T.FROM,
  to:       T.TO,
  in:       T.IN,
  while:    T.WHILE,
  break:    T.BREAK,
  continue: T.CONTINUE,
  spell:    T.SPELL,
  cast:     T.CAST,
  give:     T.GIVE,
  back:     T.BACK,
  enchant:  T.ENCHANT,
  self:     T.SELF,
  import:   T.IMPORT,
  as:       T.AS,
  try:      T.TRY,
  catch:    T.CATCH,
  raise:    T.RAISE,
  summon:   T.SUMMON,
  async:    T.ASYNC,
  await:    T.AWAIT,
  and:      T.AND,
  or:       T.OR,
  not:      T.NOT,
  true:     T.BOOLEAN,
  false:    T.BOOLEAN,
  nothing:  T.NOTHING,
};

class Token {
  constructor(type, value, line, col) {
    this.type  = type;
    this.value = value;
    this.line  = line;
    this.col   = col;
  }
  toString() { return `Token(${this.type}, ${JSON.stringify(this.value)}, L${this.line})`; }
}

class LexerError extends Error {
  constructor(msg, line, col) {
    super(`[Lexer] Line ${line}:${col} — ${msg}`);
    this.line = line; this.col = col;
  }
}

class Lexer {
  constructor(source, filename = "<stdin>") {
    this.source   = source;
    this.filename = filename;
    this.tokens   = [];
    this.indentStack = [0];
    // Track bracket depth — inside brackets, newlines are suppressed
    this.bracketDepth = 0;
  }

  tokenize() {
    const lines = this.source.replace(/\r/g, "").split("\n");

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineNum = lineIdx + 1;
      const raw     = lines[lineIdx];

      // ── Blank / comment-only lines: skip (no INDENT/DEDENT)
      const stripped = raw.trimStart();
      if (stripped === "" || stripped.startsWith("#")) continue;

      // ── Measure leading whitespace
      let indent = 0;
      for (const ch of raw) {
        if (ch === " ")  { indent++;    }
        else if (ch === "\t") { indent += 4; }
        else break;
      }

      // ── Only emit INDENT/DEDENT when not inside brackets
      if (this.bracketDepth === 0) {
        const current = this.indentStack[this.indentStack.length - 1];
        if (indent > current) {
          this.indentStack.push(indent);
          this.tokens.push(new Token(T.INDENT, indent, lineNum, 0));
        } else {
          while (indent < this.indentStack[this.indentStack.length - 1]) {
            this.indentStack.pop();
            this.tokens.push(new Token(T.DEDENT, null, lineNum, 0));
          }
          if (indent !== this.indentStack[this.indentStack.length - 1]) {
            throw new LexerError("Inconsistent indentation", lineNum, indent);
          }
        }
      }

      this._tokenizeLine(stripped, lineNum);

      if (this.bracketDepth === 0) {
        this.tokens.push(new Token(T.NEWLINE, null, lineNum, raw.length));
      }
    }

    // ── Close remaining indents
    while (this.indentStack.length > 1) {
      this.indentStack.pop();
      this.tokens.push(new Token(T.DEDENT, null, -1, 0));
    }

    this.tokens.push(new Token(T.EOF, null, -1, 0));
    return this.tokens;
  }

  _tokenizeLine(line, lineNum) {
    // Use Array.from so each element is a full Unicode codepoint (not a UTF-16 code unit).
    // This makes box-drawing chars, emoji, etc. each count as exactly 1 character.
    const chars = Array.from(line);
    let i = 0;
    const len = chars.length;
    const emit = (type, value, col) => this.tokens.push(new Token(type, value, lineNum, col));

    while (i < len) {
      const col = i;
      const ch  = chars[i];

      // Whitespace
      if (ch === " " || ch === "\t") { i++; continue; }

      // Comment — skip entire rest of line (unicode in comments is fine)
      if (ch === "#") break;

      // ── String literals
      // Accepts: "  '  \u201C (")  \u201D (")  \u2018 (')  \u2019 (')
      // Curly/smart quotes from editors are treated as regular string delimiters.
      const OPEN_QUOTES  = new Set(['"', "'", "\u201C", "\u2018"]);
      const CLOSE_QUOTES = { '"': '"', "'": "'", "\u201C": "\u201D", "\u2018": "\u2019" };

      if (OPEN_QUOTES.has(ch)) {
        const closeQ = CLOSE_QUOTES[ch];
        i++;
        let str = "";
        while (i < len && chars[i] !== closeQ && chars[i] !== ch) {
          if (chars[i] === "\\" && i + 1 < len) {
            i++;
            const esc = chars[i];
            str += esc === "n" ? "\n" : esc === "t" ? "\t" : esc === "r" ? "\r" : esc;
          } else {
            str += chars[i];
          }
          i++;
        }
        if (i >= len) throw new LexerError("Unterminated string", lineNum, col);
        i++; // closing quote
        emit(T.STRING, str, col);
        continue;
      }

      // ── Numeric literals (int or float)
      if (this._isDigit(ch)) {
        let num = "";
        while (i < len && (this._isDigit(chars[i]) || chars[i] === ".")) num += chars[i++];
        emit(T.NUMBER, parseFloat(num), col);
        continue;
      }

      // ── Identifiers & keywords
      if (this._isAlpha(ch)) {
        let word = "";
        while (i < len && this._isAlphaNum(chars[i])) word += chars[i++];
        const kwType = KEYWORDS[word];
        if (kwType === T.BOOLEAN) {
          emit(T.BOOLEAN, word === "true", col);
        } else if (kwType === T.NOTHING) {
          emit(T.NULL, null, col);
        } else if (kwType) {
          emit(kwType, word, col);
        } else {
          emit(T.IDENTIFIER, word, col);
        }
        continue;
      }

      // ── Two-character operators
      const two = chars[i] + (chars[i+1] || "");
      if (two === "**") { emit(T.STARSTAR,     "**", col); i += 2; continue; }
      if (two === "==") { emit(T.EQ,           "==", col); i += 2; continue; }
      if (two === "!=") { emit(T.NEQ,          "!=", col); i += 2; continue; }
      if (two === "<=") { emit(T.LTE,          "<=", col); i += 2; continue; }
      if (two === ">=") { emit(T.GTE,          ">=", col); i += 2; continue; }
      if (two === "+=") { emit(T.PLUS_ASSIGN,  "+=", col); i += 2; continue; }
      if (two === "-=") { emit(T.MINUS_ASSIGN, "-=", col); i += 2; continue; }

      // ── Single-character tokens
      const singles = {
        "+": T.PLUS,  "-": T.MINUS, "*": T.STAR,  "/": T.SLASH,
        "%": T.PERCENT, "=": T.ASSIGN, "<": T.LT, ">": T.GT,
        "(": T.LPAREN,  ")": T.RPAREN, "[": T.LBRACKET, "]": T.RBRACKET,
        "{": T.LBRACE,  "}": T.RBRACE, ",": T.COMMA, ":": T.COLON,
        ".": T.DOT,
      };

      if (singles[ch]) {
        // Track bracket depth to suppress newlines inside collections
        if (ch === "(" || ch === "[" || ch === "{") this.bracketDepth++;
        if (ch === ")" || ch === "]" || ch === "}") this.bracketDepth--;
        emit(singles[ch], ch, col);
        i++;
        continue;
      }

      // ── Unicode characters outside strings (box-drawing, emoji, etc.)
      // Silently skip — these appear in copy-pasted comments and decorators.
      // Only ASCII punctuation that isn't a recognised token is a hard error.
      const codePoint = ch.codePointAt(0);
      if (codePoint > 127) { i++; continue; }

      throw new LexerError(`Unknown character: '${ch}' (ASCII ${codePoint})`, lineNum, col);
    }
  }

  _isDigit(c)    { return c >= "0" && c <= "9"; }
  _isAlpha(c)    { return /[a-zA-Z_]/.test(c); }
  _isAlphaNum(c) { return /[a-zA-Z0-9_]/.test(c); }
}

module.exports = { Lexer, Token, T, KEYWORDS };