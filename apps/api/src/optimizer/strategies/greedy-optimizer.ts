import { Injectable, Logger } from '@nestjs/common';
import {
  fromIsoDate,
  toIsoDate,
  workingDatesBetween,
  type IsoDate,
} from '@workforce/shared';
import type {
  OptimizationAssignment,
  OptimizationInput,
  OptimizationResult,
  OptimizationUnassigned,
  OptimizerEmployeeInput,
  OptimizerStrategy,
  OptimizerTaskInput,
} from './optimizer-strategy.interface';

/**
 * MVP greedy strategy — day-level scheduling.
 *
 * Pipeline:
 *   1. Count dependents per task (used in composite score).
 *   2. Topologically sort tasks. Cyclic tasks are emitted as unassigned
 *      with reasonCode = CYCLIC_DEPENDENCIES.
 *   3. Within each topo level, sort by composite score descending:
 *        score = α·priority + β·(1 / max(1, daysUntilDeadline)) + γ·dependentsCount
 *   4. For each task in that order:
 *      - earliestStart = max(today, max(plannedEnd of its deps))
 *      - latestEnd     = task.deadline (or 90 days out, if undated)
 *      - For each employee with all required skills:
 *          walk working days from earliestStart..latestEnd, fill
 *          min(maxHoursPerDay - dailyLoad[user][day], remaining) into a
 *          tentative distribution. Stop when remaining == 0.
 *          If we reach latestEnd with remaining > 0 the employee doesn't fit.
 *      - Pick the eligible employee with the lowest weekly load.
 *      - Commit: update dailyLoad + weekly load, record taskEnd, emit
 *        the assignment with plannedStart / plannedEnd ISO dates.
 *   5. If no employee fits, record an unassigned entry with a specific
 *      reasonCode (MISSING_SKILLS, NO_DAILY_CAPACITY, NO_DEADLINE_RANGE,
 *      DEPENDENCIES_UNSCHEDULED).
 */
@Injectable()
export class GreedyOptimizer implements OptimizerStrategy {
  readonly name = 'greedy';
  private readonly logger = new Logger(GreedyOptimizer.name);

  async optimize(input: OptimizationInput): Promise<OptimizationResult> {
    const started = Date.now();
    const today = toUtcMidnight(input.now);

    const dependentsCount = countDependents(input.tasks);
    const { levels, cyclic } = topoSort(input.tasks);
    if (cyclic.length > 0) {
      this.logger.warn(
        `Cycle detected in task dependencies; ${cyclic.length} task(s) emitted as CYCLIC_DEPENDENCIES.`,
      );
    }

    // Working state — mutated as we place tasks.
    const weeklyLoad: Map<string, number> = new Map();
    const dailyLoad: Map<string, Map<IsoDate, number>> = new Map();
    for (const e of input.employees) {
      weeklyLoad.set(e.id, e.initialLoadHours);
      // Clone the per-employee day load so we don't mutate caller state.
      dailyLoad.set(e.id, new Map(e.initialDailyLoad));
    }

    // taskEnd: when does this task's last filled day fall? Used as the earliest
    // start for tasks that depend on it. Seeded with pre-existing assignments.
    const taskEnd = new Map<string, Date>();
    for (const [taskId, end] of input.existingTaskEndByTask) {
      if (end) taskEnd.set(taskId, toUtcMidnight(end));
    }

    const assignments: OptimizationAssignment[] = [];
    const unassigned: OptimizationUnassigned[] = [];

    // Emit cyclic tasks up-front as unassigned. They never get a chance to be
    // scheduled because we can't reason about their order.
    for (const t of cyclic) {
      unassigned.push({
        taskId: t.id,
        taskName: t.name,
        reasonCode: 'CYCLIC_DEPENDENCIES',
        reason: 'task participates in a dependency cycle',
      });
    }

    for (const level of levels) {
      const ordered = [...level].sort((a, b) => {
        const sa = compositeScore(a, dependentsCount.get(a.id) ?? 0, input.weights, input.now);
        const sb = compositeScore(b, dependentsCount.get(b.id) ?? 0, input.weights, input.now);
        return sb - sa;
      });

      for (const task of ordered) {
        // Dependency check. Any dep that is neither pre-assigned nor scheduled
        // by us is unresolved → can't place this task.
        const unresolvedDep = task.dependsOnIds.find(
          (d) => !input.preAssignedTaskIds.has(d) && !taskEnd.has(d) && !isAlreadyScheduled(d, assignments),
        );
        if (unresolvedDep) {
          unassigned.push({
            taskId: task.id,
            taskName: task.name,
            reasonCode: 'DEPENDENCIES_UNSCHEDULED',
            reason: 'one or more dependencies are not yet scheduled',
          });
          continue;
        }

        const earliestStart = computeEarliestStart(task, today, taskEnd);
        const latestEnd = task.deadline
          ? toUtcMidnight(task.deadline)
          : addUtcDays(today, 90);

        if (latestEnd.getTime() < earliestStart.getTime()) {
          unassigned.push({
            taskId: task.id,
            taskName: task.name,
            reasonCode: 'NO_DEADLINE_RANGE',
            reason: 'deadline is before the earliest possible start',
          });
          continue;
        }

        // Find candidates with all required skills.
        const skillCandidates = input.employees.filter((e) =>
          task.requiredSkillIds.every((s) => e.skillIds.includes(s)),
        );

        if (skillCandidates.length === 0) {
          unassigned.push({
            taskId: task.id,
            taskName: task.name,
            reasonCode: 'MISSING_SKILLS',
            reason: 'no employee has the required skills',
          });
          continue;
        }

        // For each candidate, try to fit the task in the date range.
        const fits: Array<{
          employee: OptimizerEmployeeInput;
          distribution: Map<IsoDate, number>;
          plannedStart: IsoDate;
          plannedEnd: IsoDate;
        }> = [];

        for (const emp of skillCandidates) {
          const empDaily = dailyLoad.get(emp.id) ?? new Map();
          const trial = tryFitTask({
            employee: emp,
            existingDailyLoad: empDaily,
            durationHours: task.durationHours,
            earliestStart,
            latestEnd,
            includeWeekends: input.includeWeekends,
          });
          if (trial) {
            fits.push({
              employee: emp,
              distribution: trial.distribution,
              plannedStart: trial.plannedStart,
              plannedEnd: trial.plannedEnd,
            });
          }
        }

        if (fits.length === 0) {
          unassigned.push({
            taskId: task.id,
            taskName: task.name,
            reasonCode: 'NO_DAILY_CAPACITY',
            reason: 'no eligible employee has enough daily capacity before the deadline',
          });
          continue;
        }

        // Pick the candidate with the lowest current weekly load.
        fits.sort(
          (a, b) =>
            (weeklyLoad.get(a.employee.id) ?? 0) - (weeklyLoad.get(b.employee.id) ?? 0),
        );
        const chosen = fits[0]!;

        // Commit the placement.
        const empDaily = dailyLoad.get(chosen.employee.id)!;
        for (const [iso, hours] of chosen.distribution) {
          empDaily.set(iso, (empDaily.get(iso) ?? 0) + hours);
        }
        weeklyLoad.set(
          chosen.employee.id,
          (weeklyLoad.get(chosen.employee.id) ?? 0) + task.durationHours,
        );
        taskEnd.set(task.id, fromIsoDate(chosen.plannedEnd));

        assignments.push({
          taskId: task.id,
          userId: chosen.employee.id,
          plannedHours: task.durationHours,
          plannedStart: chosen.plannedStart,
          plannedEnd: chosen.plannedEnd,
        });
      }
    }

    return {
      assignments,
      unassigned,
      metrics: computeMetrics(input.employees, weeklyLoad, Date.now() - started),
    };
  }
}

function isAlreadyScheduled(taskId: string, scheduled: OptimizationAssignment[]): boolean {
  for (const a of scheduled) if (a.taskId === taskId) return true;
  return false;
}

function computeEarliestStart(
  task: OptimizerTaskInput,
  today: Date,
  taskEnd: ReadonlyMap<string, Date>,
): Date {
  let earliest = today;
  for (const depId of task.dependsOnIds) {
    const end = taskEnd.get(depId);
    if (end && end.getTime() > earliest.getTime()) earliest = end;
  }
  return earliest;
}

/**
 * Try to front-fill `durationHours` for `employee` between earliestStart and
 * latestEnd, respecting `existingDailyLoad` per day. Returns null if the
 * employee does not have enough free daily capacity in the window.
 */
function tryFitTask(args: {
  employee: OptimizerEmployeeInput;
  existingDailyLoad: ReadonlyMap<IsoDate, number>;
  durationHours: number;
  earliestStart: Date;
  latestEnd: Date;
  includeWeekends: boolean;
}): {
  distribution: Map<IsoDate, number>;
  plannedStart: IsoDate;
  plannedEnd: IsoDate;
} | null {
  const dates = workingDatesBetween(args.earliestStart, args.latestEnd, args.includeWeekends);
  if (dates.length === 0) return null;

  const distribution = new Map<IsoDate, number>();
  let remaining = args.durationHours;
  let plannedStart: IsoDate | null = null;
  let plannedEnd: IsoDate | null = null;

  for (const iso of dates) {
    if (remaining <= 0) break;
    const used = args.existingDailyLoad.get(iso) ?? 0;
    const available = Math.max(0, args.employee.maxHoursPerDay - used);
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    distribution.set(iso, take);
    if (plannedStart === null) plannedStart = iso;
    plannedEnd = iso;
    remaining -= take;
  }

  if (remaining > 0 || plannedStart === null || plannedEnd === null) return null;
  return { distribution, plannedStart, plannedEnd };
}

function compositeScore(
  task: OptimizerTaskInput,
  dependents: number,
  w: { alpha: number; beta: number; gamma: number },
  now: Date,
): number {
  const days = task.deadline
    ? Math.max(1, Math.ceil((task.deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : 30;
  return w.alpha * task.priority + w.beta * (1 / Math.max(1, days)) + w.gamma * dependents;
}

function countDependents(tasks: OptimizerTaskInput[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tasks) {
    for (const d of t.dependsOnIds) {
      m.set(d, (m.get(d) ?? 0) + 1);
    }
  }
  return m;
}

/**
 * Kahn-style topological sort. Returns tasks grouped by level so that callers
 * can apply within-level ordering, plus the list of tasks that participated
 * in a cycle (caller decides how to mark them unassigned).
 */
function topoSort(tasks: OptimizerTaskInput[]): {
  levels: OptimizerTaskInput[][];
  cyclic: OptimizerTaskInput[];
} {
  const byId = new Map<string, OptimizerTaskInput>(tasks.map((t) => [t.id, t]));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const t of tasks) {
    inDegree.set(t.id, 0);
    dependents.set(t.id, []);
  }
  for (const t of tasks) {
    for (const dep of t.dependsOnIds) {
      if (!byId.has(dep)) continue; // dep outside this batch — ignore
      inDegree.set(t.id, (inDegree.get(t.id) ?? 0) + 1);
      const arr = dependents.get(dep);
      if (arr) arr.push(t.id);
    }
  }

  const levels: OptimizerTaskInput[][] = [];
  let frontier = tasks.filter((t) => (inDegree.get(t.id) ?? 0) === 0);
  const placed = new Set<string>();

  while (frontier.length > 0) {
    levels.push(frontier);
    for (const t of frontier) placed.add(t.id);

    const next: OptimizerTaskInput[] = [];
    for (const t of frontier) {
      for (const childId of dependents.get(t.id) ?? []) {
        const remaining = (inDegree.get(childId) ?? 0) - 1;
        inDegree.set(childId, remaining);
        if (remaining === 0) {
          const child = byId.get(childId);
          if (child && !placed.has(childId)) next.push(child);
        }
      }
    }
    frontier = next;
  }

  const cyclic = tasks.filter((t) => !placed.has(t.id));
  return { levels, cyclic };
}

function computeMetrics(
  employees: OptimizerEmployeeInput[],
  weeklyLoad: Map<string, number>,
  executionTimeMs: number,
) {
  if (employees.length === 0) {
    return { avgLoad: 0, stdDevLoad: 0, overloadedCount: 0, executionTimeMs };
  }
  const loads = employees.map((e) => weeklyLoad.get(e.id) ?? 0);
  const avg = loads.reduce((s, x) => s + x, 0) / loads.length;
  const variance = loads.reduce((s, x) => s + (x - avg) ** 2, 0) / loads.length;
  const overloadedCount = employees.filter(
    (e) => (weeklyLoad.get(e.id) ?? 0) > e.maxHoursPerWeek,
  ).length;
  return {
    avgLoad: roundTo(avg, 2),
    stdDevLoad: roundTo(Math.sqrt(variance), 2),
    overloadedCount,
    executionTimeMs,
  };
}

function roundTo(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function toUtcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(d: Date, delta: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + delta);
  return next;
}
