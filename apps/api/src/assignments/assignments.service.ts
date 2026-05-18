import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssignmentSource, Role, TaskStatus, type Prisma } from '@prisma/client';
import type {
  AssignmentCreateInput,
  AssignmentDto,
  AssignmentListQuery,
  AssignmentMutationResultDto,
  AssignmentUpdateInput,
  AssignmentWarningDto,
  AssignmentWithRefsDto,
} from '@workforce/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  checkDependencies,
  checkOverload,
  checkSkills,
} from './validators/assignment-validators';

type AssignmentWithUser = Prisma.AssignmentGetPayload<{
  include: { task: true };
}>;

function serializeAssignment(a: AssignmentWithUser | (Prisma.AssignmentGetPayload<true>)): AssignmentDto {
  return {
    id: a.id,
    taskId: a.taskId,
    userId: a.userId,
    plannedHours: a.plannedHours,
    plannedStart: a.plannedStart ? a.plannedStart.toISOString() : null,
    plannedEnd: a.plannedEnd ? a.plannedEnd.toISOString() : null,
    source: a.source,
    lockedByManager: a.lockedByManager,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    organizationId: string,
    filter: AssignmentListQuery,
  ): Promise<AssignmentWithRefsDto[]> {
    const assignments = await this.prisma.assignment.findMany({
      where: {
        task: { project: { organizationId } },
        ...(filter.userId ? { userId: filter.userId } : {}),
        ...(filter.projectId
          ? { task: { projectId: filter.projectId, project: { organizationId } } }
          : {}),
      },
      include: {
        task: {
          select: {
            id: true,
            name: true,
            projectId: true,
            deadline: true,
            durationHours: true,
            priority: true,
            status: true,
            project: { select: { id: true, name: true } },
          },
        },
        user: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return assignments.map((a) => ({
      id: a.id,
      taskId: a.taskId,
      userId: a.userId,
      plannedHours: a.plannedHours,
      plannedStart: a.plannedStart ? a.plannedStart.toISOString() : null,
      plannedEnd: a.plannedEnd ? a.plannedEnd.toISOString() : null,
      source: a.source,
      lockedByManager: a.lockedByManager,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      task: {
        id: a.task.id,
        name: a.task.name,
        projectId: a.task.projectId,
        projectName: a.task.project.name,
        deadline: a.task.deadline ? a.task.deadline.toISOString() : null,
        durationHours: a.task.durationHours,
        priority: a.task.priority,
        status: a.task.status,
      },
      user: { id: a.user.id, fullName: a.user.fullName, email: a.user.email },
    }));
  }

  async getByTaskId(organizationId: string, taskId: string): Promise<AssignmentDto | null> {
    // Confirm the task belongs to the org first (cross-org probe protection).
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, project: { organizationId } },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('task not found');

    const a = await this.prisma.assignment.findUnique({ where: { taskId } });
    return a ? serializeAssignment(a) : null;
  }

  async create(
    organizationId: string,
    input: AssignmentCreateInput,
  ): Promise<AssignmentMutationResultDto> {
    const task = await this.loadTaskForAssignment(organizationId, input.taskId);
    const user = await this.loadEmployeeForAssignment(organizationId, input.userId);

    const existing = await this.prisma.assignment.findUnique({ where: { taskId: input.taskId } });
    if (existing) {
      throw new HttpException(
        {
          message:
            'This task already has an assignment. Use PATCH /assignments/:id to modify or DELETE first.',
          error: 'ASSIGNMENT_EXISTS',
        },
        HttpStatus.CONFLICT,
      );
    }

    const plannedHours = input.plannedHours ?? task.durationHours;
    const warnings = await this.collectWarnings({
      organizationId,
      task,
      user,
      plannedHours,
      excludeAssignmentTaskId: null,
    });

    if (warnings.length > 0 && !input.force) {
      throw new HttpException(
        {
          message: 'Assignment has unresolved issues; resend with force=true to proceed.',
          error: 'ASSIGNMENT_WARNINGS',
          warnings,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const created = await this.prisma.assignment.create({
      data: {
        taskId: input.taskId,
        userId: input.userId,
        plannedHours,
        plannedStart: input.plannedStart ? new Date(input.plannedStart) : null,
        plannedEnd: input.plannedEnd ? new Date(input.plannedEnd) : null,
        source: AssignmentSource.MANUAL,
        lockedByManager: true,
      },
    });

    return { assignment: serializeAssignment(created), warnings };
  }

  async update(
    organizationId: string,
    id: string,
    input: AssignmentUpdateInput,
  ): Promise<AssignmentMutationResultDto> {
    const existing = await this.prisma.assignment.findFirst({
      where: { id, task: { project: { organizationId } } },
    });
    if (!existing) throw new NotFoundException('assignment not found');

    const nextUserId = input.userId ?? existing.userId;
    const nextPlannedHours = input.plannedHours ?? existing.plannedHours;

    const task = await this.loadTaskForAssignment(organizationId, existing.taskId);
    const user = await this.loadEmployeeForAssignment(organizationId, nextUserId);

    const warnings = await this.collectWarnings({
      organizationId,
      task,
      user,
      plannedHours: nextPlannedHours,
      // Don't count this assignment toward its own user's load.
      excludeAssignmentTaskId: existing.taskId,
    });

    if (warnings.length > 0 && !input.force) {
      throw new HttpException(
        {
          message: 'Assignment has unresolved issues; resend with force=true to proceed.',
          error: 'ASSIGNMENT_WARNINGS',
          warnings,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const updated = await this.prisma.assignment.update({
      where: { id },
      data: {
        userId: nextUserId,
        plannedHours: nextPlannedHours,
        ...(input.plannedStart !== undefined
          ? { plannedStart: input.plannedStart ? new Date(input.plannedStart) : null }
          : {}),
        ...(input.plannedEnd !== undefined
          ? { plannedEnd: input.plannedEnd ? new Date(input.plannedEnd) : null }
          : {}),
      },
    });

    return { assignment: serializeAssignment(updated), warnings };
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const existing = await this.prisma.assignment.findFirst({
      where: { id, task: { project: { organizationId } } },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('assignment not found');
    await this.prisma.assignment.delete({ where: { id } });
  }

  async setLock(organizationId: string, id: string, locked: boolean): Promise<AssignmentDto> {
    const existing = await this.prisma.assignment.findFirst({
      where: { id, task: { project: { organizationId } } },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('assignment not found');
    const updated = await this.prisma.assignment.update({
      where: { id },
      data: { lockedByManager: locked },
    });
    return serializeAssignment(updated);
  }

  // ---------- internal helpers ----------

  private async loadTaskForAssignment(organizationId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, project: { organizationId } },
      include: {
        skills: { include: { skill: true } },
        dependsOn: {
          include: { dependsOn: { include: { assignment: true } } },
        },
      },
    });
    if (!task) throw new NotFoundException('task not found');
    return task;
  }

  private async loadEmployeeForAssignment(organizationId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
      include: { skills: { select: { skillId: true } } },
    });
    if (!user) throw new NotFoundException('user not found');
    return user;
  }

  /**
   * Validate skills / overload / dependencies and return the list of warnings.
   *
   * For overload, `excludeAssignmentTaskId` lets the caller subtract the
   * assignment they're updating from the user's "current load" before adding
   * the new hours back in — otherwise we'd double-count.
   */
  private async collectWarnings(args: {
    organizationId: string;
    task: Prisma.TaskGetPayload<{
      include: {
        skills: { include: { skill: true } };
        dependsOn: { include: { dependsOn: { include: { assignment: true } } } };
      };
    }>;
    user: Prisma.UserGetPayload<{
      include: { skills: { select: { skillId: true } } };
    }>;
    plannedHours: number;
    excludeAssignmentTaskId: string | null;
  }): Promise<AssignmentWarningDto[]> {
    if (args.user.role !== Role.EMPLOYEE) {
      // Manager / admin assignments are unusual but legal. Skip skill +
      // overload checks since "max hours per week" still applies (we keep
      // overload), but skills probably aren't tracked for managers.
      // Drop skill check; keep overload + dep checks.
    }

    const warnings: AssignmentWarningDto[] = [];

    // Skill check — only meaningful for employees (managers/admins aren't typed
    // by skill in this MVP). Skip if user has no skill list AND task has none either.
    if (args.user.role === Role.EMPLOYEE) {
      const requiredSkillNames = new Map<string, string>(
        args.task.skills.map((ts) => [ts.skillId, ts.skill.name]),
      );
      const skillWarn = checkSkills({
        user: {
          fullName: args.user.fullName,
          skillIds: args.user.skills.map((s) => s.skillId),
        },
        task: {
          requiredSkillIds: args.task.skills.map((ts) => ts.skillId),
          requiredSkillNames,
        },
      });
      if (skillWarn) warnings.push(skillWarn);
    }

    // Overload check — sum the user's existing assignments (excluding the one
    // being modified, if any).
    const load = await this.prisma.assignment.aggregate({
      where: {
        userId: args.user.id,
        ...(args.excludeAssignmentTaskId
          ? { NOT: { taskId: args.excludeAssignmentTaskId } }
          : {}),
      },
      _sum: { plannedHours: true },
    });
    const currentLoadHours = load._sum.plannedHours ?? 0;
    const overWarn = checkOverload({
      user: {
        fullName: args.user.fullName,
        maxHoursPerWeek: args.user.maxHoursPerWeek,
        currentLoadHours,
      },
      plannedHours: args.plannedHours,
    });
    if (overWarn) warnings.push(overWarn);

    // Dependencies — task.dependsOn relates TaskDependency rows; each carries
    // .dependsOn = the prerequisite Task with its current assignment.
    const depWarn = checkDependencies({
      task: {
        dependsOn: args.task.dependsOn.map((d) => ({
          id: d.dependsOn.id,
          name: d.dependsOn.name,
          status: d.dependsOn.status as TaskStatus,
          hasAssignment: d.dependsOn.assignment !== null,
        })),
      },
    });
    if (depWarn) warnings.push(depWarn);

    return warnings;
  }
}
