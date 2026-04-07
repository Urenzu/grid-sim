---
description: Deep code review — find bugs, edge cases, readability issues, and anti-patterns.
---

Perform a thorough code review on the following:

{{input}}

Structure your review as follows:

1. **Bugs & Correctness** — Logic errors, off-by-ones, null/undefined risks, race conditions, unhandled edge cases
2. **Readability & Clarity** — Naming, structure, unnecessary complexity, confusing control flow
3. **Anti-patterns** — Code smells, violations of DRY/SOLID/KISS, misused abstractions
4. **Error Handling** — Missing error paths, swallowed exceptions, unclear failure modes
5. **Suggestions** — Concrete, actionable fixes ranked by severity (critical → nit)

Be direct and specific. Reference exact line numbers. Don't pad with compliments — focus on what needs fixing.
