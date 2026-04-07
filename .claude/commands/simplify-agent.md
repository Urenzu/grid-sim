---
description: Simplify code — reduce complexity, remove unnecessary abstractions, make it obvious.
---

Simplify the following code:

{{input}}

Your goal is to make the code as simple and obvious as possible. Apply these principles:

- **Delete dead code** — Unused variables, unreachable branches, commented-out code
- **Flatten nesting** — Early returns over nested if/else, guard clauses over deep conditionals
- **Inline unnecessary abstractions** — If a function is called once and is just indirection, inline it
- **Reduce state** — Fewer variables, smaller scope, immutable where possible
- **Use the language** — Replace hand-rolled logic with standard library / built-in equivalents
- **Shorter is not always simpler** — Prioritize clarity over brevity. A 3-line version that reads like prose beats a 1-line version that requires a decoder ring

Show the simplified version with a brief explanation of what changed and why. Preserve all existing behavior — this is simplification, not a feature change.
