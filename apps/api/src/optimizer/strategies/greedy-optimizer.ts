import { Injectable, Logger } from '@nestjs/common';
import type {
  OptimizationInput,
  OptimizationResult,
  OptimizerEmployeeInput,
  OptimizerStrategy,
  OptimizerTaskInput,
} from './optimizer-strategy.interface';

/**
 * MVP greedy strategy.
 *
 * 1. Count dependents per task (used in composite score).
 * 2. Topologically sort tasks; if a cycle is found, log a warning and treat
 *    dependencies as if they did not exist (per ADR-0003 / the brief caveat).
 * 3. Within each topo level, sort by composite score descending:
 *      score = α·priority + β·(1 / max(1, daysUntilDeadline)) + γ·dependentsCount
 * 4. For each task in that order: pick the eligible employee with the
 *    minimum current load (skills match, hour capacity left, all dependencies
 *    already assigned). Update load and emit an assignment.
 * 5. If no eligible employee, record an unassigned entry with a reason.
 */
@Injectable()
export class GreedyOptimizer implements OptimizerStrategy {
  readonly name = 'greedy';
  private readonly logger = new Logger(GreedyOptimizer.name);

  async optimize(input: OptimizationInput): Promise<OptimizationResult> {
    const started = Date.now();

    const dependentsCount = countDependents(input.tasks);
    const { levels, hasCycle } = topoSort(input.tasks);
    if (hasCycle) {
      this.logger.warn('Cycle detected in task dependencies; ignoring deps for cyclic tasks.');
    }

    // Working load: prefilled with each employee's initial load.
    const load: Record<string, number> = {};
    for (const e of input.employees) {
      load[e.id] = e.initialLoadHours;
    }

    // Tasks that have an assignment by the time we evaluate a dependent.
    // Seeded with the pre-existing assignments so an IN_PROGRESS dep counts as satisfied.
    const assignedTaskIds = new Set<string>(input.preAssignedTaskIds);

    const assignments: OptimizationResult['assignments'] = [];
    const unassigned: OptimizationResult['unassigned'] = [];

    for (const level of levels) {
      const ordered = [...level].sort((a, b) => {
        const sa = compositeScore(a, dependentsCount.get(a.id) ?? 0, input.weights, input.now);
        const sb = compositeScore(b, dependentsCount.get(b.id) ?? 0, input.weights, input.now);
        return sb - sa;
      });

      for (const task of ordered) {
        // Dependency check (skip when we ignored deps due to a cycle).
        if (!hasCycle && task.dependsOnIds.length > 0) {
          const missing = task.dependsOnIds.filter((d) => !assignedTaskIds.has(d));
          if (missing.length > 0) {
            unassigned.push({
              taskId: task.id,
              taskName: task.name,
              reason: `dependencies not yet assigned: ${missing.length} missing`,
            });
            continue;
          }
        }

        const eligible = input.employees.filter((e) => {
          const hasAllSkills = task.requiredSkillIds.every((s) => e.skillIds.includes(s));
          if (!hasAllSkills) return false;
          const next = (load[e.id] ?? 0) + task.durationHours;
          return next <= e.maxHoursPerWeek;
        });

        if (eligible.length === 0) {
          unassigned.push({
            taskId: task.id,
            taskName: task.name,
            reason: 'no eligible employee (missing skills or no capacity)',
          });
          continue;
        }

        const chosen = pickMinLoad(eligible, load);
        load[chosen.id] = (load[chosen.id] ?? 0) + task.durationHours;
        assignments.push({
          taskId: task.id,
          userId: chosen.id,
          plannedHours: task.durationHours,
        });
        assignedTaskIds.add(task.id);
      }
    }

    return {
      assignments,
      unassigned,
      metrics: computeMetrics(input.employees, load, Date.now() - started),
    };
  }
}

function compositeScore(
  task: OptimizerTaskInput,
  dependents: number,
  w: { alpha: number; beta: number; gamma: number },
  now: Date,
): number {
  const days = task.deadline
    ? Math.max(1, Math.ceil((task.deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : 30; // arbitrary "far future" when no deadline
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
 * can apply within-level ordering (e.g. by composite score). Reports whether
 * a cycle was encountered — if so, tasks that couldn't be placed are appended
 * to a final "ignored deps" level.
 */
function topoSort(tasks: OptimizerTaskInput[]): {
  levels: OptimizerTaskInput[][];
  hasCycle: boolean;
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
      if (!byId.has(dep)) continue; // dep outside this batch (e.g. cross-project) — ignore
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
  if (cyclic.length > 0) {
    levels.push(cyclic);
    return { levels, hasCycle: true };
  }
  return { levels, hasCycle: false };
}

function pickMinLoad(
  employees: OptimizerEmployeeInput[],
  load: Record<string, number>,
): OptimizerEmployeeInput {
  let best = employees[0]!;
  for (const e of employees) {
    if ((load[e.id] ?? 0) < (load[best.id] ?? 0)) best = e;
  }
  return best;
}

function computeMetrics(
  employees: OptimizerEmployeeInput[],
  load: Record<string, number>,
  executionTimeMs: number,
) {
  if (employees.length === 0) {
    return { avgLoad: 0, stdDevLoad: 0, overloadedCount: 0, executionTimeMs };
  }
  const loads = employees.map((e) => load[e.id] ?? 0);
  const avg = loads.reduce((s, x) => s + x, 0) / loads.length;
  const variance = loads.reduce((s, x) => s + (x - avg) ** 2, 0) / loads.length;
  const overloadedCount = employees.filter((e) => (load[e.id] ?? 0) > e.maxHoursPerWeek).length;
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
