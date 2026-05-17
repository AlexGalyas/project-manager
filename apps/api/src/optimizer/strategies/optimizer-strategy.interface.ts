// The interface every optimization strategy must satisfy. A future LP / GA /
// CP-SAT strategy can plug in here without touching the controller, service,
// or persistence layer. See ADR-0003.

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
  skillIds: string[];
  initialLoadHours: number;
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
  weights: OptimizerWeights;
  /** "Now" for deadline calculations — passed in for testability. */
  now: Date;
}

export interface OptimizationAssignment {
  taskId: string;
  userId: string;
  plannedHours: number;
}

export interface OptimizationUnassigned {
  taskId: string;
  taskName: string;
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
