export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type WorkloadStatus = 'under' | 'normal' | 'over';
export type AssignmentSource = 'MANUAL' | 'OPTIMIZER';
export type AssignmentWarningCode =
  | 'MISSING_SKILLS'
  | 'OVERLOAD'
  | 'DAILY_OVERLOAD'
  | 'UNRESOLVED_DEPENDENCIES';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  organizationId: string;
  maxHoursPerWeek: number;
  maxHoursPerDay: number;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface SkillDto {
  id: string;
  name: string;
  /** Optional usage counts; populated by /skills (admin view) for context. */
  usage?: {
    users: number;
    tasks: number;
  };
}

export interface UserSummaryDto {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  maxHoursPerWeek: number;
  maxHoursPerDay: number;
  skills: { skillId: string; name: string; level: number }[];
}

export interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  priority: number;
  startDate: string | null;
  endDate: string | null;
  taskCount: number;
}

export interface TaskDto {
  id: string;
  projectId: string;
  name: string;
  durationHours: number;
  deadline: string | null;
  priority: number;
  status: TaskStatus;
  skills: { skillId: string; name: string }[];
  dependsOnIds: string[];
  assignment: AssignmentDto | null;
}

export interface ProjectWithTasksDto extends ProjectDto {
  tasks: TaskDto[];
}

export interface AssignmentDto {
  id: string;
  taskId: string;
  userId: string;
  plannedHours: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  source: AssignmentSource;
  lockedByManager: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentWithRefsDto extends AssignmentDto {
  task: {
    id: string;
    name: string;
    projectId: string;
    projectName: string;
    deadline: string | null;
    durationHours: number;
    priority: number;
    status: TaskStatus;
  };
  user: { id: string; fullName: string; email: string };
}

export interface AssignmentWarningDto {
  code: AssignmentWarningCode;
  message: string;
  details?: unknown;
}

export interface AssignmentMutationResultDto {
  assignment: AssignmentDto;
  warnings: AssignmentWarningDto[];
}

export interface WorkloadEntryDto {
  userId: string;
  fullName: string;
  plannedHours: number;
  maxHours: number;
  maxHoursPerDay: number;
  status: WorkloadStatus;
}

export interface OptimizerAssignmentDto {
  taskId: string;
  userId: string;
  plannedHours: number;
  plannedStart: string;
  plannedEnd: string;
}

export type OptimizerUnassignedReason =
  | 'MISSING_SKILLS'
  | 'NO_DAILY_CAPACITY'
  | 'DEPENDENCIES_UNSCHEDULED'
  | 'NO_DEADLINE_RANGE'
  | 'CYCLIC_DEPENDENCIES'
  | 'OTHER';

export interface OptimizerUnassignedDto {
  taskId: string;
  taskName: string;
  /** Stable machine-readable reason code, for grouped UI display. */
  reasonCode: OptimizerUnassignedReason;
  /** Human-readable explanation. */
  reason: string;
}

export interface OptimizerMetricsDto {
  avgLoad: number;
  stdDevLoad: number;
  overloadedCount: number;
  executionTimeMs: number;
}

export interface OptimizerResultDto {
  strategy: string;
  assignments: OptimizerAssignmentDto[];
  unassigned: OptimizerUnassignedDto[];
  /** Existing assignments left untouched (manual or locked). */
  preservedCount: number;
  /** Locked count (subset of preservedCount; for UI emphasis). */
  lockedCount: number;
  /** OPTIMIZER-source rows deleted by replaceExisting=true. 0 when replaceExisting=false. */
  removedCount: number;
  metrics: OptimizerMetricsDto;
}
