// The interface every optimization strategy must satisfy. A future LP / GA /
// CP-SAT strategy can plug in here without touching the controller, service,
// or persistence layer. See ADR-0003.

import type { IsoDate, OptimizerUnassignedReason } from '@workforce/shared';

export interface OptimizerTaskInput {
  id: string;
  projectId: string;
  name: string;
  durationHours: number;
  priority: number;
  deadline: Date | null;
  requiredSkillIds: string[];
  dependsOnIds: string[];
}

export interface OptimizerEmployeeInput {
  id: string;
  maxHoursPerWeek: number;
  maxHoursPerDay: number;
  skillIds: string[];
  /** Total hours from pre-existing surviving assignments (manual + locked + unflushed). */
  initialLoadHours: number;
  /**
   * Per-day load already booked from surviving assignments, keyed by YYYY-MM-DD
   * (UTC). The optimizer subtracts this from `maxHoursPerDay` when computing
   * free capacity per day.
   */
  initialDailyLoad: Map<IsoDate, number>;
}

export interface OptimizerWeights {
  alpha: number;
  beta: number;
  gamma: number;
}

export interface OptimizationInput {
  tasks: OptimizerTaskInput[];
  employees: OptimizerEmployeeInput[];
  /** Tasks that already have an assignment (e.g. IN_PROGRESS); their deps are considered satisfied. */
  preAssignedTaskIds: ReadonlySet<string>;
  /** Map taskId -> userId for already-assigned tasks (for the dep check). */
  existingAssignmentByTask: ReadonlyMap<string, string>;
  /**
   * For each task that already has an assignment, the day it is scheduled
   * to finish (or null if unknown). The optimizer uses this as the earliest
   * possible start for a downstream dependent task.
   */
  existingTaskEndByTask: ReadonlyMap<string, Date | null>;
  weights: OptimizerWeights;
  /** Whether to schedule on Saturday / Sunday. Default: false. */
  includeWeekends: boolean;
  /** "Now" for deadline calculations — passed in for testability. */
  now: Date;
}

export interface OptimizationAssignment {
  taskId: string;
  userId: string;
  plannedHours: number;
  /** ISO date (YYYY-MM-DD) of the first day the optimizer placed work on. */
  plannedStart: IsoDate;
  /** ISO date (YYYY-MM-DD) of the last day the optimizer placed work on. */
  plannedEnd: IsoDate;
}

export interface OptimizationUnassigned {
  taskId: string;
  taskName: string;
  reasonCode: OptimizerUnassignedReason;
  reason: string;
}

export interface OptimizationMetrics {
  avgLoad: number;
  stdDevLoad: number;
  overloadedCount: number;
  executionTimeMs: number;
}

export interface OptimizationResult {
  assignments: OptimizationAssignment[];
  unassigned: OptimizationUnassigned[];
  metrics: OptimizationMetrics;
}

export interface OptimizerStrategy {
  readonly name: string;
  optimize(input: OptimizationInput): Promise<OptimizationResult>;
}
