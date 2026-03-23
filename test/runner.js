#!/usr/bin/env node
"use strict";

// ════════════════════════════════════════════════════════════
//  ELAINA v3 — TEST RUNNER
//  Tests each language feature in isolation.
//  Run: node test/runner.js
// ════════════════════════════════════════════════════════════

const { Interpreter } = require("../src/interpreter");

let passed = 0;
let failed = 0;

function test(name, source, expectedOutputs) {
  const results = [];
  const interp  = new Interpreter({ outputFn: (s) => results.push(String(s)) });

  try {
    interp.run(source);
  } catch (err) {
    if (expectedOutputs === "ERROR") {
      console.log(`  ✓ ${name} (expected error: ${err.message.split("\n")[0]})`);
      passed++;
      return;
    }
    console.error(`  ✗ ${name} — threw: ${err.message}`);
    failed++;
    return;
  }

  if (expectedOutputs === "ERROR") {
    console.error(`  ✗ ${name} — expected an error but none thrown`);
    failed++;
    return;
  }

  const expected = Array.isArray(expectedOutputs) ? expectedOutputs : [expectedOutputs];
  for (let i = 0; i < expected.length; i++) {
    if (results[i] !== String(expected[i])) {
      console.error(`  ✗ ${name}`);
      console.error(`      expected[${i}]: ${JSON.stringify(expected[i])}`);
      console.error(`      got[${i}]:      ${JSON.stringify(results[i])}`);
      failed++;
      return;
    }
  }
  console.log(`  ✓ ${name}`);
  passed++;
}

// ─────────────────────────────────────────────────────────────
console.log("\n✦ Elaina v3 — Test Suite\n");

// ── Literals & say ────────────────────────────────────────
console.log("Literals");
test("number",  `say 42`,          ["42"]);
test("float",   `say 3.14`,        ["3.14"]);
test("string",  `say "hello"`,     ["hello"]);
test("boolean", `say true`,        ["true"]);
test("nothing", `say nothing`,     ["nothing"]);

// ── Variables ─────────────────────────────────────────────
console.log("\nVariables");
test("let", `let x = 10\nsay x`, ["10"]);
test("reassign", `let x = 1\nx = 2\nsay x`, ["2"]);
test("augmented +=", `let x = 5\nx += 3\nsay x`, ["8"]);
test("augmented -=", `let x = 10\nx -= 4\nsay x`, ["6"]);
test("string concat", `let a = "hi"\nlet b = " there"\nsay a + b`, ["hi there"]);

// ── Arithmetic ────────────────────────────────────────────
console.log("\nArithmetic");
test("add",   `say 2 + 3`,     ["5"]);
test("sub",   `say 10 - 4`,    ["6"]);
test("mul",   `say 3 * 4`,     ["12"]);
test("div",   `say 10 / 4`,    ["2.5"]);
test("mod",   `say 10 % 3`,    ["1"]);
test("power", `say 2 ** 10`,   ["1024"]);
test("unary minus", `say -5`,  ["-5"]);
test("precedence", `say 2 + 3 * 4`, ["14"]);
test("parens",     `say (2 + 3) * 4`, ["20"]);

// ── Comparisons ───────────────────────────────────────────
console.log("\nComparisons");
test("eq true",  `say 5 == 5`, ["true"]);
test("eq false", `say 5 == 6`, ["false"]);
test("neq",      `say 5 != 6`, ["true"]);
test("lt",       `say 3 < 5`,  ["true"]);
test("gt",       `say 5 > 3`,  ["true"]);
test("lte",      `say 5 <= 5`, ["true"]);
test("gte",      `say 5 >= 6`, ["false"]);

// ── Boolean logic ─────────────────────────────────────────
console.log("\nBoolean Logic");
test("and true",  `say true and true`,  ["true"]);
test("and false", `say true and false`, ["false"]);
test("or true",   `say false or true`,  ["true"]);
test("or false",  `say false or false`, ["false"]);
test("not true",  `say not true`,       ["false"]);
test("not false", `say not false`,      ["true"]);

// ── If / elif / else ──────────────────────────────────────
console.log("\nConditionals");
test("if true",   `if true:\n    say "yes"`, ["yes"]);
test("if false",  `if false:\n    say "yes"\nelse:\n    say "no"`, ["no"]);
test("elif",
  `let x = 5\nif x > 10:\n    say "big"\nelif x > 3:\n    say "medium"\nelse:\n    say "small"`,
  ["medium"]
);

// ── Loops ─────────────────────────────────────────────────
console.log("\nLoops");
test("loop range", `loop i from 1 to 3:\n    say i`, ["1","2","3"]);
test("loop in list",
  `let xs = [10, 20, 30]\nloop x in xs:\n    say x`,
  ["10","20","30"]
);
test("while",
  `let i = 0\nwhile i < 3:\n    i += 1\n    say i`,
  ["1","2","3"]
);
test("break",
  `loop i from 1 to 10:\n    if i == 4:\n        break\n    say i`,
  ["1","2","3"]
);
test("continue",
  `loop i from 1 to 5:\n    if i == 3:\n        continue\n    say i`,
  ["1","2","4","5"]
);

// ── Spells (Functions) ────────────────────────────────────
console.log("\nSpells");
test("basic spell",
  `spell hi():\n    say "hi"\ncast hi()`,
  ["hi"]
);
test("spell with params",
  `spell add(a, b):\n    give back a + b\nsay add(3, 4)`,
  ["7"]
);
test("recursion (factorial)",
  `spell fact(n):\n    if n <= 1:\n        give back 1\n    give back n * fact(n - 1)\nsay fact(5)`,
  ["120"]
);
test("closure",
  `spell make(x):\n    spell inner():\n        give back x * 2\n    give back inner\nlet f = make(5)\nsay f()`,
  ["10"]
);

// ── Lists ─────────────────────────────────────────────────
console.log("\nLists");
test("list literal",   `say [1, 2, 3]`,         ["[1, 2, 3]"]);
test("list index",     `let l = [10,20,30]\nsay l[1]`, ["20"]);
test("list neg index", `let l = [1,2,3]\nsay l[-1]`,   ["3"]);
test("list push/pop",
  `let l = [1,2]\nl.push(3)\nsay l\nsay l.pop()`,
  ["[1, 2, 3]","3"]
);
test("list length",   `say len([1,2,3,4])`, ["4"]);
test("list join",     `say join(["a","b","c"], "-")`, ["a-b-c"]);
test("list sort",     `let l = [3,1,2]\nsay l.sort()`, ["[1, 2, 3]"]);
test("list concat",   `let a = [1,2]\nlet b = [3,4]\nsay a + b`, ["[1, 2, 3, 4]"]);

// ── Dicts ─────────────────────────────────────────────────
console.log("\nDicts");
test("dict literal",
  `let d = {"x": 1, "y": 2}\nsay d["x"]`,
  ["1"]
);
test("dict set/get",
  `let d = {}\nd["key"] = "val"\nsay d["key"]`,
  ["val"]
);
test("dict has",
  `let d = {"a": 1}\nsay d.has("a")\nsay d.has("b")`,
  ["true", "false"]
);

// ── Enchant (Classes) ─────────────────────────────────────
console.log("\nEnchant (Classes)");
test("basic class",
  [
    `enchant Point:`,
    `    spell init(x, y):`,
    `        self.x = x`,
    `        self.y = y`,
    `    spell show():`,
    `        say self.x + "," + self.y`,
    `let p = Point(3, 4)`,
    `cast p.show()`,
  ].join("\n"),
  ["3,4"]
);
test("class method return",
  [
    `enchant Calc:`,
    `    spell init(val):`,
    `        self.val = val`,
    `    spell double():`,
    `        give back self.val * 2`,
    `let c = Calc(7)`,
    `say c.double()`,
  ].join("\n"),
  ["14"]
);
test("class inheritance",
  [
    `enchant Base:`,
    `    spell init(x):`,
    `        self.x = x`,
    `    spell getX():`,
    `        give back self.x`,
    `enchant Child from Base:`,
    `    spell init(x, y):`,
    `        self.x = x`,
    `        self.y = y`,
    `    spell sum():`,
    `        give back self.x + self.y`,
    `let obj = Child(3, 4)`,
    `say obj.sum()`,
    `say obj.getX()`,
  ].join("\n"),
  ["7", "3"]
);

// ── Try / Catch / Raise ───────────────────────────────────
console.log("\nError Handling");
test("try-catch no error",
  `try:\n    say "ok"\ncatch e:\n    say "error"`,
  ["ok"]
);
test("try-catch with raise",
  `try:\n    raise "oops"\ncatch e:\n    say "caught: " + e`,
  ["caught: oops"]
);
test("raise unhandled", `raise "fail"`, "ERROR");

// ── Built-ins ─────────────────────────────────────────────
console.log("\nBuilt-ins");
test("sqrt",  `say sqrt(16)`,    ["4"]);
test("abs",   `say abs(-7)`,     ["7"]);
test("floor", `say floor(3.9)`,  ["3"]);
test("ceil",  `say ceil(3.1)`,   ["4"]);
test("round", `say round(3.5)`,  ["4"]);
test("pow",   `say pow(2, 8)`,   ["256"]);
test("max",   `say max(1,5,3)`,  ["5"]);
test("min",   `say min(9,2,7)`,  ["2"]);
test("upper", `say upper("hi")`, ["HI"]);
test("lower", `say lower("HI")`, ["hi"]);
test("len str",`say len("hello")`, ["5"]);
test("str",   `say str(42)`,     ["42"]);
test("num",   `say num("3.14")`, ["3.14"]);
test("type number", `say type(42)`,       ["number"]);
test("type string", `say type("hi")`,     ["string"]);
test("type list",   `say type([1,2])`,    ["list"]);
test("type nothing",`say type(nothing)`,  ["nothing"]);
test("format", `say format("Hello, {}!", "World")`, ["Hello, World!"]);

// ── String methods ────────────────────────────────────────
console.log("\nString Methods");
test("str.upper",    `say "hello".upper()`,          ["HELLO"]);
test("str.split",    `say "a,b,c".split(",")`,        ["[a, b, c]"]);
test("str.includes", `say "hello".includes("ell")`,   ["true"]);
test("str.replace",  `say "hi there".replace("there","world")`, ["hi world"]);

// ─────────────────────────────────────────────────────────────
const total = passed + failed;
console.log(`\n${"─".repeat(40)}`);
console.log(`  Results: ${passed}/${total} passed`);
if (failed > 0) {
  console.log(`  ✗ ${failed} failed`);
  process.exit(1);
} else {
  console.log(`  ✓ All tests passed! ✦`);
}
console.log(`${"─".repeat(40)}\n`);
