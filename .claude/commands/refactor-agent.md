---
description: Refactor code — restructure for better design without changing behavior.
---

Refactor the following:

{{input}}

Approach:

1. **Identify the problem** — What structural issue makes this code hard to work with? (tight coupling, god objects, tangled responsibilities, duplicated logic, etc.)
2. **Name the refactoring** — Use established patterns where applicable (extract method, replace conditional with polymorphism, introduce parameter object, etc.)
3. **Show the refactored code** — Complete, working replacement. Not pseudocode.
4. **Explain the tradeoffs** — What got better? What got slightly worse? Is the added structure justified by the current complexity, or is it premature?

Rules:
- Behavior must be preserved exactly — same inputs, same outputs, same side effects
- Don't over-abstract. If the code is used in one place, a simple function is fine. Don't build a framework.
- If the code is already fine and just needs minor cleanup, say so. Not everything needs refactoring.
