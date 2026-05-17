# ADR-0003: Greedy algorithm behind a Strategy interface

- **Status**: Accepted
- **Date**: 2026-05-17

## Context

The optimizer is the heart of the thesis. It must distribute tasks across employees while respecting skills, weekly capacity, task dependencies, and a composite priority score (priority × deadline urgency × #dependents).

Reasonable algorithmic choices include:

1. **Greedy / heuristic** — sort tasks by score, assign each to the least-loaded eligible employee.
2. **Linear / mixed-integer programming** (e.g. via OR-Tools / GLPK) — formulate as a constrained optimization problem and let the solver find a globally good solution.
3. **Metaheuristics** — genetic algorithms, simulated annealing, tabu search.
4. **Constraint programming** — Google OR-Tools CP-SAT.

For the MVP, we must (a) deliver a working assignment in the demo, (b) explain the algorithm in the thesis text, (c) keep the implementation auditable, and (d) leave the door open for richer methods in a future chapter or extension.

## Decision

Ship a **greedy heuristic** as the MVP implementation, but isolate it behind a strict `OptimizerStrategy` interface so that smarter strategies can be swapped in without touching the controller, the persistence layer, or the metrics surface.

```
interface OptimizerStrategy {
  readonly name: string;
  optimize(input: OptimizationInput): Promise<OptimizationResult>;
}
```

Layout:

```
apps/api/src/optimizer/
  optimizer.module.ts
  optimizer.controller.ts        POST /optimizer/run
  optimizer.service.ts           orchestrates: load → strategy.optimize → persist
  strategies/
    optimizer-strategy.interface.ts
    greedy-optimizer.ts
```

The greedy strategy (see `greedy-optimizer.ts`) topologically sorts tasks, ranks by composite priority within each level, and at each step picks the eligible employee with the minimum current load.

## Consequences

**Positive**

- Linear-time algorithm (O(T × E) for T tasks, E employees) — runs in milliseconds for the seeded dataset.
- Easy to explain in the thesis: pseudo-code fits on a slide.
- Strategy pattern means a future ADR (e.g. ADR-0007) can introduce `LpOptimizer` or `GeneticOptimizer` as a peer.
- The same `OptimizationResult` (with `metrics`) makes greedy and future strategies directly comparable in benchmarks for the thesis evaluation chapter.

**Negative / tradeoffs**

- Greedy is locally optimal, globally not. It can produce assignments where a small global swap would reduce stdev of load — the user sees this and may wonder why. The thesis must own this limitation explicitly.
- Dependency handling is conservative: a task is only schedulable if all its dependencies already have an assignment. Cycles are logged and the deps ignored — a heavier method would not need this kludge.
- The `metrics` surface (avg load, stddev, overloaded count, execution time) was chosen because it's meaningful for greedy; a future LP strategy may want richer metrics (objective value, optimality gap) — extending the type is acceptable.
