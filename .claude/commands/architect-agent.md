---
description: Architecture analysis — evaluate design decisions, module boundaries, and system structure.
---

Analyze the architecture of the following:

{{input}}

Evaluate:

1. **Current Structure** — Map out the modules, their responsibilities, and how they connect. Identify the dependency graph.

2. **Separation of Concerns** — Are responsibilities cleanly divided? Are there modules doing too much? Are there artificial boundaries that add complexity without value?

3. **Coupling & Cohesion** — What depends on what? Are there hidden dependencies (shared mutable state, implicit ordering, global config)? Could modules be swapped out or tested independently?

4. **Data Flow** — How does data move through the system? Are there unnecessary transformations, copies, or format changes? Is the flow easy to trace?

5. **Extension Points** — Where would you add a new feature? How many files would you touch? Would changes cascade?

6. **Recommendations** — Concrete suggestions with rationale. Distinguish between:
   - Things to fix now (structural problems causing real pain)
   - Things to consider later (improvements that matter at larger scale)
   - Things to leave alone (acceptable tradeoffs for current scope)

Think pragmatically. Good architecture serves the project's actual scale and team size, not an idealized version.
