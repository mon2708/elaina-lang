<div align="center">

```
╔═══════════════════════════════════════════════════╗
║                                                   ║
║    ✦  E L A I N A   L A N G U A G E  v3.0  ✦    ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
```

**A spell-powered, fantasy-themed scripting language built on Node.js**

[![Version](https://img.shields.io/badge/version-3.0.0-blueviolet?style=flat-square)](https://github.com/yourname/elaina-lang)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-83%2F83%20passing-success?style=flat-square)](#testing)

*Simple syntax. Fantasy keywords. Real power.*

</div>

---

## ✦ What is Elaina?

Elaina is a dynamically-typed scripting language with a clean, readable syntax inspired by Python — but with a magical twist. Instead of `def`, you write `spell`. Instead of calling functions, you `cast` them.

It's designed to be:
- **Beginner-friendly** — minimal boilerplate, no semicolons, no brackets hell
- **Powerful** — classes, closures, error handling, modules, AI integration
- **Fun** — because programming should feel like casting spells ✦

---

## ✦ Quick Look

```elaina
# Define a spell (function)
spell greet(name):
    say "Hello, " + name + "!"

cast greet("World")

# Classes with enchant
enchant Hero:
    spell init(name, level):
        self.name  = name
        self.level = level

    spell describe():
        say self.name + " — Level " + self.level

let hero = Hero("Elaina", 42)
cast hero.describe()

# Loops
loop i from 1 to 5:
    say i + " squared = " + i ** 2

# Lists and dicts
let items = ["sword", "potion", "scroll"]
loop item in items:
    say "Item: " + item

# Error handling
try:
    raise "Something went wrong!"
catch err:
    say "Caught: " + err
```

---

## ✦ Installation

**Requirements:** Node.js v18+

```bash
# Clone the repo
git clone https://github.com/yourname/elaina-lang.git
cd elaina-lang

# Install globally (optional)
npm install -g .

# Run a file
node elaina.js run examples/hello.ela

# Or if installed globally
elaina run examples/hello.ela
```

---

## ✦ CLI Usage

```bash
elaina run <file.ela>           # Run a program
elaina run <file.ela> --async   # Run with async + AI summon support
elaina check <file.ela>         # Syntax check only
elaina repl                     # Interactive REPL
elaina version                  # Show version
```

### Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Enable real AI `summon` commands |
| `ELAINA_DEBUG=1` | Show full stack traces on errors |

---

## ✦ Language Reference

### Variables

```elaina
let name   = "Elaina"
let level  = 42
let active = true
let empty  = nothing
```

### Operators

```elaina
# Arithmetic
say 2 + 3       # 5
say 10 / 4      # 2.5
say 2 ** 8      # 256  (exponent)
say 10 % 3      # 1    (modulo)

# Augmented assignment
let x = 10
x += 5
x -= 2

# Comparison
say 5 == 5      # true
say 5 != 6      # true
say 3 < 5       # true

# Logic
say true and false    # false
say true or false     # true
say not true          # false
```

### Conditionals

```elaina
if score >= 90:
    say "Grade: A"
elif score >= 75:
    say "Grade: B"
else:
    say "Grade: C"
```

### Loops

```elaina
# Range loop
loop i from 1 to 10:
    say i

# Iterate over a list
let fruits = ["apple", "mango", "lychee"]
loop fruit in fruits:
    say fruit

# While loop
let count = 5
while count > 0:
    say count
    count -= 1

# Loop control
loop i from 1 to 10:
    if i == 3:
        continue
    if i == 7:
        break
    say i
```

### Spells (Functions)

```elaina
# Basic spell
spell add(a, b):
    give back a + b

say add(3, 4)    # 7

# Recursive spell
spell factorial(n):
    if n <= 1:
        give back 1
    give back n * factorial(n - 1)

say factorial(8)    # 40320

# Closures
spell makeCounter():
    let count = 0
    spell increment():
        count += 1
        give back count
    give back increment

let counter = makeCounter()
say counter()    # 1
say counter()    # 2
```

### Lists

```elaina
let nums = [3, 1, 4, 1, 5, 9, 2, 6]

say nums[0]       # 3   (first)
say nums[-1]      # 6   (last)
say len(nums)     # 8

nums.push(99)
nums.pop()
let sorted = nums.sort()
let sliced = nums.slice(1, 4)

# Concatenation
let more = nums + [10, 11, 12]
```

### Dicts

```elaina
let hero = {"name": "Elaina", "level": 15}

say hero["name"]       # Elaina
hero["guild"] = "Wanderers"

say hero.has("guild")  # true
say hero.keys()        # [name, level, guild]
hero.remove("level")
```

### Enchant (Classes)

```elaina
enchant Animal:
    spell init(name, sound):
        self.name  = name
        self.sound = sound

    spell speak():
        say self.name + " says " + self.sound

# Inheritance
enchant Dog from Animal:
    spell init(name):
        self.name  = name
        self.sound = "Woof"
        self.tricks = []

    spell learn(trick):
        self.tricks.push(trick)

let dog = Dog("Rex")
cast dog.speak()
cast dog.learn("sit")
```

### Error Handling

```elaina
spell riskyOp(val):
    if val < 0:
        raise "Negative value not allowed"
    give back val * 2

try:
    say riskyOp(-5)
catch err:
    say "Caught: " + err
```

### Modules

```elaina
# Built-in stdlib modules
import "math"
import "string"
import "list"
import "io"
import "system"

say math.get("PI")
say math.get("sqrt")(16)

# Your own .ela files
import "utils/helpers" as helpers
```

**Built-in stdlib modules:**

| Module | Functions |
|---|---|
| `math` | `sqrt`, `pow`, `abs`, `floor`, `ceil`, `round`, `sin`, `cos`, `log`, `random`, `randint`, `clamp` |
| `string` | `upper`, `lower`, `trim`, `split`, `replace`, `contains`, `startsWith`, `format` |
| `list` | `make`, `range`, `concat`, `map`, `filter`, `reduce`, `sum`, `zip`, `enumerate` |
| `io` | `readFile`, `writeFile`, `appendFile`, `exists`, `listDir`, `cwd` |
| `system` | `exit`, `env`, `args`, `now`, `time` |

### AI Summon

```elaina
# Requires ANTHROPIC_API_KEY environment variable
# Run with: elaina run main.ela --async

summon "write a bubble sort spell in Elaina" as code
say code
```

### Input

```elaina
let name = ask "Enter your name: "
say "Hello, " + name
```

---

## ✦ Built-in Functions

| Function | Description |
|---|---|
| `say x` | Print to stdout |
| `len(x)` | Length of string, list, or dict |
| `str(x)` | Convert to string |
| `num(x)` | Convert to number |
| `type(x)` | Get type name |
| `range(a, b)` | Create list from a to b |
| `sqrt(x)` | Square root |
| `abs(x)` | Absolute value |
| `floor(x)` | Round down |
| `ceil(x)` | Round up |
| `round(x)` | Round nearest |
| `pow(x, y)` | x to the power of y |
| `max(...)` | Maximum value |
| `min(...)` | Minimum value |
| `random()` | Random float 0–1 |
| `randint(a, b)` | Random integer a to b |
| `upper(s)` | Uppercase string |
| `lower(s)` | Lowercase string |
| `split(s, sep)` | Split string into list |
| `join(list, sep)` | Join list into string |
| `contains(s, sub)` | Check substring |
| `format(tmpl, ...)` | String formatting with `{}` |

---

## ✦ Project Structure

```
elaina-lang/
├── elaina.js           ← CLI entry point
├── elaina-game.js      ← Game runtime runner
├── package.json
├── src/
│   ├── lexer.js        ← Tokenizer (source → tokens)
│   ├── parser.js       ← Recursive descent parser (tokens → AST)
│   ├── environment.js  ← Lexical scope chain
│   ├── stdlib.js       ← Standard library + type system
│   ├── interpreter.js  ← Tree-walking executor
│   └── gameruntime.js  ← Real-time game loop extension
├── examples/
│   ├── all_examples.ela
│   └── snake.ela       ← Playable Snake game in Elaina!
└── test/
    └── runner.js       ← 83-test suite
```

---

## ✦ Examples

### Hello World

```elaina
say "Hello, World!"
```

### FizzBuzz

```elaina
loop i from 1 to 100:
    if i % 15 == 0:
        say "FizzBuzz"
    elif i % 3 == 0:
        say "Fizz"
    elif i % 5 == 0:
        say "Buzz"
    else:
        say i
```

### Fibonacci with memoization

```elaina
let memo = {}

spell fib(n):
    if memo.has(n):
        give back memo.get(n)
    if n <= 1:
        give back n
    let result = fib(n - 1) + fib(n - 2)
    memo.set(n, result)
    give back result

loop i from 0 to 20:
    say "fib(" + i + ") = " + fib(i)
```

### Snake Game

Elaina supports real-time terminal games via the game runtime extension:

```bash
node elaina-game.js examples/snake.ela
```

Controls: `W A S D` to move, `P` to pause, `Ctrl+C` to quit.

---

## ✦ Testing

```bash
node test/runner.js
```

```
✦ Elaina v3 — Test Suite

Literals          ✓ ✓ ✓ ✓ ✓
Variables         ✓ ✓ ✓ ✓ ✓
Arithmetic        ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓
Comparisons       ✓ ✓ ✓ ✓ ✓ ✓ ✓
Boolean Logic     ✓ ✓ ✓ ✓ ✓ ✓
Conditionals      ✓ ✓ ✓
Loops             ✓ ✓ ✓ ✓ ✓
Spells            ✓ ✓ ✓ ✓
Lists             ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓
Dicts             ✓ ✓ ✓
Enchant (Classes) ✓ ✓ ✓
Error Handling    ✓ ✓ ✓
Built-ins         ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ...
String Methods    ✓ ✓ ✓ ✓

Results: 83/83 passed ✦
```

---

## ✦ Roadmap

- [ ] `foreach` / list comprehensions
- [ ] Native string interpolation: `"Hello {name}!"`
- [ ] Standard file I/O in base language
- [ ] Package manager (`charm install`)
- [ ] VSCode syntax highlighting extension
- [ ] Bytecode compiler (v4)
- [ ] AI-assisted debugging: `debug "why is my loop broken"`

---

## ✦ Syntax Cheatsheet

```
Variables       let x = 10
Reassign        x = 20  |  x += 5  |  x -= 2
Print           say "Hello"
Input           let x = ask "Enter: "
Function def    spell name(params):
Function call   cast name(args)  |  name(args)
Return          give back value
If              if cond:  |  elif:  |  else:
Loop range      loop i from 1 to 10:
Loop over       loop item in list:
While           while cond:
Break/Continue  break  |  continue
Class           enchant Name:
Inherit         enchant Child from Parent:
Self            self.field = value
Import          import "module"  |  import "mod" as m
Try/Catch       try:  |  catch err:
Raise           raise "message"
AI              summon "prompt" as result
Nothing         nothing
Boolean         true  |  false
Comment         # this is a comment
```

---

## ✦ License

MIT — do whatever you want with it. Just keep the magic alive. ✦

---

<div align="center">

*Built with ✦ and Node.js*

</div>
