export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type WorkloadStatus = 'under' | 'normal' | 'over';

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
  createdAt: string;
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

export interface WorkloadEntryDto {
  userId: string;
  fullName: string;
  plannedHours: number;
  maxHours: number;
  status: WorkloadStatus;
}

export interface OptimizerAssignmentDto {
  taskId: string;
  userId: string;
  plannedHours: number;
}

export interface OptimizerUnassignedDto {
  taskId: string;
  taskName: string;
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
  metrics: OptimizerMetricsDto;
}
