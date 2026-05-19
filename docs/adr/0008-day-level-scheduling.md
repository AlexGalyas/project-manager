# ADR-0008: Day-level scheduling with front-fill front-end reconstruction

- **Status**: Accepted
- **Date**: 2026-05-19

## Context

Phase 4–7.5 tracked workload per employee only at the **weekly** granularity: `User.maxHoursPerWeek`, optimizer sums `plannedHours` into a `loadByUser` map, ceil the sum against the cap, done. The greedy optimizer would happily stack three 8-hour tasks onto an employee whose weekly total was still under 40, producing impossible single-day loads (e.g. 14 hours of work scheduled for Wednesday). The workload heatmap papered over this by bucketing each assignment onto its task's deadline cell — a 14h task with deadline Wed showed as a single 14h cell, even though no human could complete it in a day.

Phase 9 has to do three things that all touch the same model:

1. Schedule work day-by-day, respecting a per-user **daily** cap that may be less than `maxHoursPerWeek / 5`.
2. Persist enough information per assignment that the heatmap, the task list, and downstream dependents all know **when** a task is scheduled, not just how many hours it consumes.
3. Surface specific failure modes from the optimizer (`no daily capacity before deadline`, `dependencies not yet scheduled`, `missing skills`) so managers can act on each category instead of a generic "couldn't place" message.

### Decision axes

#### Axis 1 — Where the per-day truth lives

- **(A)** Store `plannedStart` + `plannedEnd` columns only; reconstruct the per-day distribution on the fly via front-fill.
- **(B)** Add a `dailyDistribution Json` column to `Assignment` (`{ "2026-05-19": 8, "2026-05-20": 6, ... }`).
- **(C)** Add a separate `AssignmentDay` row-per-day table.

#### Axis 2 — Scheduling algorithm shape

- **(D)** Per-task, per-employee greedy front-fill: walk dates from `earliestStart` to `latestEnd`, fill at `maxHoursPerDay`, pick the candidate with the lowest weekly load.
- **(E)** Constraint solver (CP-SAT / ILP) over per-day variables.
- **(F)** Heuristic + local search refinement.

#### Axis 3 — Weekend policy

- **(G)** Always skip weekends.
- **(H)** Always allow weekends.
- **(I)** Per-run boolean toggle.

#### Axis 4 — Backward compatibility for legacy rows

- **(J)** Migrate old `plannedStart NULL` rows by writing an automatic schedule on first read.
- **(K)** Treat null start/end as "unscheduled" in the UI; force the manager to re-run the optimizer or re-save the assignment to populate it.

## Decision

- **(A)** Store `plannedStart` + `plannedEnd` only. Reconstruct per-day distribution via the shared `frontFillSchedule` / `distributeAssignmentByDay` helpers in `@workforce/shared`.
- **(D)** Greedy front-fill with topological-sort-first, score within level. The strategy interface (ADR-0003) is intact; any future strategy can replace `GreedyOptimizer` without touching service/persistence layers.
- **(I)** Per-run `includeWeekends: boolean` toggle on `OptimizerRunInput`, defaulting to `false`. The manual-assignment endpoints also default to Mon-Fri auto-distribution; managers can still write an explicit weekend `plannedStart` if they want to.
- **(K)** Legacy rows with `plannedStart = NULL` are surfaced in the UI as "unscheduled" (with a `TriangleAlert` badge). The next optimizer run with `replaceExisting: true` cleans them up. Manual `PATCH /assignments/:id` also populates the columns via the auto-distribute path.

### Algorithm details

```
for each task in topo order, sorted by score within level:
  earliestStart = max(today, max(plannedEnd of dependencies))
  latestEnd     = task.deadline ?? (today + 90 days)

  for each employee with all required skills:
    walk working days from earliestStart..latestEnd (skip weekends if !includeWeekends)
    for each day, take min(maxHoursPerDay - dailyLoad[user][day], remainingHours)
    record the tentative distribution
    if remainingHours > 0 at latestEnd → this employee does not fit

  among fits, pick the lowest current weekly load
  commit: update dailyLoad[user] + weeklyLoad[user]
  record plannedStart = first filled day, plannedEnd = last filled day
  remember taskEnd[task] = plannedEnd  // for dependents downstream
```

Unassigned tasks emit a stable `reasonCode` so the manager UI can group + colour them: `NO_DAILY_CAPACITY` (no employee has free room before the deadline), `MISSING_SKILLS`, `DEPENDENCIES_UNSCHEDULED`, `NO_DEADLINE_RANGE` (the deadline is before earliestStart), `CYCLIC_DEPENDENCIES`, or `OTHER`.

### Heatmap reconstruction

Because we don't store the per-day map, the web has to recompute it. Per-assignment front-fill in isolation would double-count days (two overlapping 14h assignments would both claim 8h on day 1), so the reconstruction processes assignments **per user** in `(plannedStart, createdAt)` order, with a running `userDaily` map that each new assignment front-fills against. The result mirrors the optimizer's placement well enough that the heatmap matches reality.

### Daily-overload warning

`POST /assignments` and `PATCH /assignments/:id` add a fourth validator: `checkDailyOverload`. It builds the user's existing per-day load (distributed via the same shared helper) **excluding** the assignment being mutated, then checks the new assignment's distribution day-by-day. The warning's `details.offenders` is a list of `{ date, currentLoad, addedHours, maxHoursPerDay }` so the modal can show every offending day in one view. Like the other warnings (`MISSING_SKILLS`, `OVERLOAD`, `UNRESOLVED_DEPENDENCIES`), it's a soft block — `force: true` overrides.

## Consequences

**Positive**

- The optimizer cannot produce impossible single-day loads any more. The acceptance test against seed data finds zero days over `maxHoursPerDay`.
- Dependents respect their dependencies' end dates, so the scheduler no longer plans downstream tasks on days the dependency hasn't finished yet.
- The same `distributeAssignmentByDay` helper powers (a) the optimizer's pre-run `existingDailyLoad`, (b) the manual-assignment warning check, and (c) the front-end heatmap. Single source of truth, single bug surface.
- Unassigned items now carry a machine-readable `reasonCode`; the manager UI groups them with coloured Badges so a fresh manager can immediately see "27 tasks have no eligible employee with the skills" vs "3 tasks waited on unscheduled deps".
- Weekend policy is a per-run choice. Hot-fix Saturday work? Toggle the checkbox.

**Negative / tradeoffs**

- **No persisted per-day map.** The heatmap reconstruction is order-sensitive. Two managers creating overlapping manual assignments concurrently can produce a transiently wrong reconstruction until the optimizer is re-run. For the thesis MVP this is acceptable; in a production system either store the distribution or read the optimizer's audit log.
- **UTC everywhere.** All date math is on UTC midnight. Users east of UTC see what's stored, not what they would call "today" locally. This is the MVP simplification; multi-tenant production needs `User.timezone` plus per-user formatting.
- **`overloadedCount` semantics drift.** The metric still counts users whose total scheduled hours exceed `maxHoursPerWeek`, but with multi-week scheduling that no longer means "this employee is over capacity this week" — only "their total backlog exceeds the per-week cap." The UI still surfaces it usefully; a follow-up could introduce `weeklyOverloadedCount` and `dailyOverloadedCount` if needed.
- **Greedy is greedy.** With `maxHoursPerDay = 8` and a heavy task list, fewer tasks get placed than under the old weekly-only model (seed data: 22/60 vs ~40/60). That's not a regression — it's the daily constraint correctly refusing to overload anyone. The `NO_DAILY_CAPACITY` items make the bottleneck visible.

## Rejected alternatives

- **(B) `dailyDistribution Json`.** The cleanest reconstruction story, but adds a column whose only purpose is to cache something the helpers already compute deterministically (given assignment order). The order-sensitivity caveat is real but rare in practice for a thesis MVP. Revisit if multi-user concurrent editing becomes common.
- **(C) Separate `AssignmentDay` table.** Cleanest for analytical queries ("how many hours did Employee 5 work on Monday across all assignments?") but doubles the surface area of every assignment write. Overkill for the MVP.
- **(E) CP-SAT / ILP.** Overshoots the thesis scope; the greedy + topo-sort baseline is a reasonable plug-in point and the strategy interface from ADR-0003 leaves the door open for a future replacement.
- **(F) Local search.** Premature; the greedy result is fine for the demo dataset and the explicit `reasonCode` breakdown is more useful for evaluation than marginal placement improvements.
- **(G) Always skip / (H) Always include weekends.** Removes a useful manager choice for the sake of API simplicity. The `includeWeekends` toggle is one boolean and saves real friction in the demo flow.
- **(J) Auto-write a schedule for legacy NULL rows.** Risk of silently changing what a manager sees on next load. Better to flag them as "unscheduled" and let the next optimizer run handle them deliberately.

## Code touched

- `apps/api/prisma/schema.prisma` — `User.maxHoursPerDay Int @default(8)`.
- `apps/api/prisma/migrations/20260519061239_add_max_hours_per_day/migration.sql`.
- `apps/api/prisma/seed.ts` — set `maxHoursPerDay: 8` for every seeded user (explicit, even though the default would do).
- `packages/shared/src/scheduling.ts` — new file. `toIsoDate`, `fromIsoDate`, `isWeekend`, `addDaysUtc`, `workingDatesBetween`, `frontFillSchedule`, `distributeAssignmentByDay`. Shared by API + web.
- `packages/shared/src/types.ts` — `AuthUser.maxHoursPerDay`, `UserSummaryDto.maxHoursPerDay`, `WorkloadEntryDto.maxHoursPerDay`, new `OptimizerUnassignedReason` union, `OptimizerAssignmentDto.plannedStart` + `.plannedEnd`, `OptimizerUnassignedDto.reasonCode`, new `'DAILY_OVERLOAD'` warning code.
- `packages/shared/src/schemas.ts` — `OptimizerRunInputSchema.includeWeekends`, `User*InputSchema.maxHoursPerDay`, `Assignment*InputSchema` accept ISO date or datetime strings.
- `apps/api/src/optimizer/strategies/optimizer-strategy.interface.ts` — `OptimizerEmployeeInput.maxHoursPerDay` + `.initialDailyLoad`, `OptimizationAssignment.plannedStart` + `.plannedEnd`, `OptimizationInput.includeWeekends` + `.existingTaskEndByTask`, `OptimizationUnassigned.reasonCode`.
- `apps/api/src/optimizer/strategies/greedy-optimizer.ts` — rewritten around the day-level loop: builds `weeklyLoad` + `dailyLoad` per user, threads `taskEnd` through the topological levels, emits `plannedStart` / `plannedEnd` + `reasonCode`.
- `apps/api/src/optimizer/optimizer.service.ts` — distributes surviving assignments into each user's `initialDailyLoad` before invoking the strategy; persists `plannedStart` / `plannedEnd` from the result.
- `apps/api/src/assignments/validators/assignment-validators.ts` — new `checkDailyOverload`. Old `checkSkills` / `checkOverload` / `checkDependencies` unchanged.
- `apps/api/src/assignments/assignments.service.ts` — `resolveSchedule` helper auto-distributes when start/end omitted; warnings now include `DAILY_OVERLOAD`; `PATCH` always normalises the schedule.
- `apps/api/src/users/users.service.ts` + `apps/api/src/auth/auth.service.ts` — surface `maxHoursPerDay` in DTOs.
- `apps/api/src/workload/workload.service.ts` — `WorkloadEntryDto.maxHoursPerDay` populated from the user row.
- `apps/web/src/lib/workload-week.ts` — `bucketAssignmentsByDay` rewritten to process assignments per user in `(plannedStart, createdAt)` order, front-filling against a running daily-load map per user.
- `apps/web/src/app/(authed)/manager/workload/page.tsx` + `/employee/workload/page.tsx` — pass each user's `maxHoursPerDay` into the bucketing function, surface the new `unscheduledCount` and `outsideWeekCount` notes, drop the old "maxHoursPerWeek / 5" estimate.
- `apps/web/src/app/(authed)/manager/optimizer/page.tsx` — "Include weekends" Checkbox in step 2; unassigned tasks grouped by `reasonCode` with coloured Badges.
- `apps/web/src/app/(authed)/manager/projects/[id]/page.tsx` — new "Schedule" column showing `plannedStart → plannedEnd (Nh)` with a "needs scheduling" Badge when null.
- `apps/web/src/app/(authed)/admin/users/new/page.tsx` + `/admin/users/[id]/page.tsx` — `maxHoursPerDay` input with 1–24 validation.
- `apps/web/src/components/AssignmentWarningsModal.tsx` — adds a `CalendarClock` icon for `DAILY_OVERLOAD`.
