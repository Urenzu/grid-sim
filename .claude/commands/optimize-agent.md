---
description: Optimize code — analyze time/space complexity, find bottlenecks, improve performance.
---

Analyze and optimize the following:

{{input}}

Provide:

1. **Current Complexity Analysis**
   - Time complexity: Big-O for each significant operation/function
   - Space complexity: Memory allocation patterns, object lifetimes
   - Identify the dominant cost — what actually matters at scale

2. **Bottleneck Identification**
   - Hot paths and tight loops
   - Unnecessary allocations (string concatenation in loops, repeated object creation, array copies)
   - Redundant computation (repeated lookups, recalculated values, missing memoization)
   - I/O bottlenecks (blocking calls, N+1 queries, unbatched operations)
   - Data structure mismatches (linear search where a hash would work, array where a set fits)

3. **Optimized Version**
   - Show the optimized code
   - State the new time/space complexity
   - Explain each change and its impact

4. **Tradeoffs**
   - Readability cost vs performance gain
   - When the optimization actually matters (data size thresholds, call frequency)
   - Whether the bottleneck is even worth optimizing (profile before you optimize)

Be honest — if the code is already efficient for its use case, say so. Don't micro-optimize for the sake of it.
