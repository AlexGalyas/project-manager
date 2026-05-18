# ADR-0006: Assignment source + manager-locking model

- **Status**: Accepted
- **Date**: 2026-05-18
- **Note on numbering**: the original brief named this ADR `0005`, but `0005` is already taken by the User & Skill admin design (Phase 7). This file is `0006`.

## Context

After Phase 4 (the greedy optimizer) and Phase 7 (admin CRUD on users + skills), managers complained that re-running the optimizer would wipe assignments they had set manually. The current `replaceExisting=true` path in the optimizer service deletes **every** assignment in scope before rerunning — there is no concept of "this row was placed by a human, leave it alone."

Phase 7.5 needs to support:

1. Manual assignment of a task to an employee, including reassigning, changing planned hours, and unassigning.
2. A way for a manager to declare "do not touch this" that survives any number of subsequent optimizer runs.
3. Soft validation: skill mismatches, overload, unresolved deps should warn the manager but not block them (with an explicit `force: true` override).
4. Backward compatibility with the existing optimizer interface and DTOs as much as possible.

Three modeling axes had to be decided.

### Axis 1: One `Assignment` table vs split tables

Alternatives considered:

- **(A)** Keep the single `Assignment` table; add a `source` enum (`MANUAL` / `OPTIMIZER`) and a `lockedByManager` boolean.
- **(B)** A separate `ManualAssignment` table, with the optimizer writing to `Assignment` and joining the two views.
- **(C)** A single `Assignment` table with a polymorphic `metadata: Json` blob carrying source/lock fields.

### Axis 2: Locking model

- **(D)** `lockedByManager` is intrinsic to a row, settable independently of `source`.
- **(E)** Lock implicitly tied to source — manual is always locked, optimizer is never locked, no separate flag.

### Axis 3: Optimizer-rerun semantics

- **(F)** Hard delete + recreate every time (existing Phase 4 behaviour).
- **(G)** Soft-delete optimizer rows on rerun (set a `replacedAt` timestamp), keep them archived.
- **(H)** Hard delete only OPTIMIZER-source AND unlocked rows; never touch manual or locked.

## Decision

- **(A)** One `Assignment` table, two new columns: `source AssignmentSource @default(MANUAL)` and `lockedByManager Boolean @default(false)`.
- **(D)** Lock is **orthogonal** to source. A manager can lock an optimizer-created assignment (`source=OPTIMIZER, lockedByManager=true`) — both stay independently meaningful.
- **(H)** `replaceExisting: true` deletes only `source = OPTIMIZER AND lockedByManager = false` rows within the scope. The optimizer then collects "candidate tasks" = TODO tasks in scope that **don't currently have any assignment** (after the optional cleanup).

Manual `POST /assignments` defaults to `source: MANUAL, lockedByManager: true` so that the manager's deliberate action sticks. Optimizer-created assignments default to `source: OPTIMIZER, lockedByManager: false` so a rerun can rebalance them.

The optimizer's initial per-employee load includes the sum of `plannedHours` from **all** surviving assignments (manual + locked + any unlocked optimizer rows in scope that weren't cleaned up), so the strategy never proposes work that would push a user past their cap when factoring in placements the manager has already locked.

### Validation: warnings, not blockers

`POST /assignments` and `PATCH /assignments/:id` run three validators (`checkSkills`, `checkOverload`, `checkDependencies`). If any return a warning AND `force: false`, the endpoint returns **422 Unprocessable Entity** with a body:

```json
{
  "error": {
    "code": "ASSIGNMENT_WARNINGS",
    "message": "Assignment has unresolved issues; resend with force=true to proceed.",
    "details": { "warnings": [ ... ] }
  }
}
```

The frontend reads `details.warnings` from the error envelope, shows a modal with each warning, and on "Assign anyway" replays the same payload with `force: true`. Forced operations always succeed (assuming auth + role + 4xx-level validity), and the same `warnings` array comes back in the success body so the manager can see what they overrode.

## Consequences

**Positive**

- Manual decisions survive any number of optimizer reruns. The only way to remove a locked or manual row is an explicit `DELETE /assignments/:id` (which is what unassigning *should* do).
- The optimizer's "load includes locked" change means the strategy never produces work that conflicts with locked placements — overload is impossible by construction except where the manager has chosen it.
- The `source` enum makes it trivial to slice the UI: "show me what the optimizer did" vs "show me my manual placements" is a one-line filter.
- 422 + `details.warnings` is a clean shape — same envelope as every other error in the system, the frontend's existing `ApiError.details` path delivers the structured payload, and the friendly-message map from ADR-0005 still applies to non-warning error codes.
- Two API routes (`PATCH /assignments/:id/lock` and `/unlock`) are easier to reason about than overloading PATCH with a `lockedByManager` field; the existing PATCH stays focused on the data, not the policy.

**Negative / tradeoffs**

- Two extra columns on every assignment row (`source`, `lockedByManager`, plus `updatedAt`) — cheap, but worth noting as schema surface area.
- The `LOCKED ⇒ never modified by optimizer` invariant is enforced in service code, not in the database. A future stored-procedure or trigger could harden it; for the MVP, the test suite + the focused optimizer service file are the safety net.
- "Lock" terminology may surprise managers who expect "lock" to forbid all changes, including manual ones. The UI tooltip clarifies: lock protects from the optimizer; managers can still change locked rows manually. ADR-noted; if user feedback flags this, rename the flag to `protectedFromOptimizer`.
- Validators run on every `POST /assignments` and every `PATCH /assignments/:id` regardless of whether the user passed `force: true`. This costs one extra `aggregate` query for overload, but the result is included in the response body so the manager can audit what they overrode. Acceptable.

## Rejected alternatives

- **(B) Separate `ManualAssignment` table.** Doubles the surface for every "show me the schedule" query (UNION the two tables, dedup by task, prioritize manual). The single-table-with-flag approach keeps reads simple.
- **(C) JSON metadata blob.** Loses type safety and indexability. We need to filter by `source` and `lockedByManager` in WHERE clauses (already an index on each).
- **(E) Lock tied to source.** Loses the ability for a manager to "freeze" an optimizer placement they like without first deleting + recreating it. Manager workflow demands the orthogonality.
- **(G) Soft delete on optimizer rerun.** Adds a "is the assignment alive?" filter to every assignment-reading query. The replay history of past optimizer runs isn't useful to the MVP; if it ever is, a dedicated `optimizer_run` audit table is a cleaner shape.

## Code touched

- `apps/api/prisma/schema.prisma` — `enum AssignmentSource`, new `source` + `lockedByManager` + `updatedAt` fields, indexes on `source` and `lockedByManager`.
- `apps/api/prisma/migrations/.../add_assignment_source_and_lock`.
- `apps/api/src/assignments/validators/assignment-validators.ts` — three pure helpers returning `AssignmentWarningDto | null`.
- `apps/api/src/assignments/assignments.service.ts` — new `create`, `update`, `setLock`, `getByTaskId`; existing `delete` and `list` unchanged (list now serializes the new fields).
- `apps/api/src/assignments/assignments.controller.ts` — `POST /`, `PATCH /:id`, `POST /:id/lock`, `POST /:id/unlock`.
- `apps/api/src/tasks/tasks.controller.ts` + `tasks.module.ts` — `GET /tasks/:id/assignment` (delegates to `AssignmentsService`).
- `apps/api/src/optimizer/optimizer.service.ts` — rewritten flow: scope tasks → optional cleanup (OPTIMIZER + unlocked only) → re-read surviving assignments → candidate tasks = scope minus survivors → load = sum of survivors → strategy → `create` (not `upsert`) with `source: OPTIMIZER`. Returns `preservedCount`, `lockedCount`, `removedCount`.
- `apps/api/src/common/http-exception.filter.ts` — passes through `body.details` and `body.warnings` so 422 responses carry the warnings array to clients.
- `packages/shared` — new Zod schemas (`AssignmentCreateInput`, `AssignmentUpdateInput`), new types (`AssignmentSource`, `AssignmentWarningCode`, `AssignmentWarningDto`, `AssignmentMutationResultDto`), extended `AssignmentDto` (source / lockedByManager / updatedAt), extended `OptimizerResultDto` (preservedCount / lockedCount / removedCount).
- `apps/web/src/lib/api/assignments.ts` — new wrappers + `extractAssignmentWarnings()` helper.
- `apps/web/src/components/AssigneeCell.tsx` + `AssignmentWarningsModal.tsx` — the task-row UI.
- `apps/web/src/app/(authed)/manager/optimizer/page.tsx` — "Schedule unassigned" vs "Re-optimize everything" radio, plus preserved/locked/removed counters in the result strip.
