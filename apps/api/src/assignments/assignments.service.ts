import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssignmentSource, Role, TaskStatus, type Prisma } from '@prisma/client';
import {
  distributeAssignmentByDay,
  fromIsoDate,
  frontFillSchedule,
  toIsoDate,
  type AssignmentCreateInput,
  type AssignmentDto,
  type AssignmentListQuery,
  type AssignmentMutationResultDto,
  type AssignmentUpdateInput,
  type AssignmentWarningDto,
  type AssignmentWithRefsDto,
  type IsoDate,
} from '@workforce/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  checkDailyOverload,
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
    const schedule = this.resolveSchedule({
      plannedStart: input.plannedStart ?? null,
      plannedEnd: input.plannedEnd ?? null,
      plannedHours,
      maxHoursPerDay: user.maxHoursPerDay,
    });

    const warnings = await this.collectWarnings({
      organizationId,
      task,
      user,
      plannedHours,
      addedDailyLoad: schedule.distribution,
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
        plannedStart: schedule.plannedStart ? fromIsoDate(schedule.plannedStart) : null,
        plannedEnd: schedule.plannedEnd ? fromIsoDate(schedule.plannedEnd) : null,
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

    // Recompute schedule. If the caller provided plannedStart/plannedEnd
    // (including explicit null), respect them; otherwise carry forward what
    // the row already has, or auto-distribute if both are missing.
    const startInput =
      input.plannedStart !== undefined
        ? input.plannedStart
        : existing.plannedStart
          ? existing.plannedStart.toISOString()
          : null;
    const endInput =
      input.plannedEnd !== undefined
        ? input.plannedEnd
        : existing.plannedEnd
          ? existing.plannedEnd.toISOString()
          : null;

    const schedule = this.resolveSchedule({
      plannedStart: startInput,
      plannedEnd: endInput,
      plannedHours: nextPlannedHours,
      maxHoursPerDay: user.maxHoursPerDay,
    });

    const warnings = await this.collectWarnings({
      organizationId,
      task,
      user,
      plannedHours: nextPlannedHours,
      addedDailyLoad: schedule.distribution,
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
        plannedStart: schedule.plannedStart ? fromIsoDate(schedule.plannedStart) : null,
        plannedEnd: schedule.plannedEnd ? fromIsoDate(schedule.plannedEnd) : null,
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

  /**
   * Decide the (plannedStart, plannedEnd, daily distribution) triple for a
   * new or updated assignment.
   *
   * - If both `plannedStart` and `plannedEnd` are provided, use them and
   *   front-fill the distribution against `maxHoursPerDay` within the range.
   * - If only one is provided, use it as the anchor and auto-fill the other
   *   end by walking forward until `plannedHours` is exhausted.
   * - If neither is provided, start today (UTC) and auto-fill forward.
   *
   * Weekends are skipped in auto-distribution (Mon-Fri only); managers can
   * still override by setting an explicit weekend date.
   */
  private resolveSchedule(opts: {
    plannedStart: string | null;
    plannedEnd: string | null;
    plannedHours: number;
    maxHoursPerDay: number;
  }): {
    plannedStart: IsoDate | null;
    plannedEnd: IsoDate | null;
    distribution: Map<IsoDate, number>;
  } {
    const todayIso = toIsoDate(new Date());
    const start = opts.plannedStart ? toIsoDate(new Date(opts.plannedStart)) : todayIso;
    // Without an explicit end, give the auto-distributor a generous window
    // (60 working days) so it can spread however many hours are needed.
    const endAnchor = opts.plannedEnd
      ? toIsoDate(new Date(opts.plannedEnd))
      : null;

    if (endAnchor) {
      const dist = distributeAssignmentByDay({
        plannedStart: start,
        plannedEnd: endAnchor,
        plannedHours: opts.plannedHours,
        maxHoursPerDay: opts.maxHoursPerDay,
        includeWeekends: false,
      });
      return {
        plannedStart: dist.size > 0 ? [...dist.keys()][0]! : start,
        plannedEnd: dist.size > 0 ? [...dist.keys()][dist.size - 1]! : endAnchor,
        distribution: dist,
      };
    }

    const window = new Date(fromIsoDate(start));
    window.setUTCDate(window.getUTCDate() + 60);
    const result = frontFillSchedule({
      from: fromIsoDate(start),
      to: window,
      durationHours: opts.plannedHours,
      maxHoursPerDay: opts.maxHoursPerDay,
      includeWeekends: false,
    });
    return {
      plannedStart: result.plannedStart ?? start,
      plannedEnd: result.plannedEnd ?? start,
      distribution: result.distribution,
    };
  }

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
   * Validate skills / weekly overload / daily overload / dependencies and
   * return the list of warnings.
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
    addedDailyLoad: ReadonlyMap<IsoDate, number>;
    excludeAssignmentTaskId: string | null;
  }): Promise<AssignmentWarningDto[]> {
    const warnings: AssignmentWarningDto[] = [];

    // 1. Skill check — only meaningful for employees.
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

    // 2. Weekly overload — sum the user's other assignments.
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

    // 3. Daily overload — distribute every other assignment by day and check
    //    whether any day in the new assignment's window exceeds maxHoursPerDay.
    const otherAssignments = await this.prisma.assignment.findMany({
      where: {
        userId: args.user.id,
        ...(args.excludeAssignmentTaskId
          ? { NOT: { taskId: args.excludeAssignmentTaskId } }
          : {}),
      },
      select: { plannedHours: true, plannedStart: true, plannedEnd: true },
    });
    const existingDailyLoad = new Map<IsoDate, number>();
    for (const a of otherAssignments) {
      if (!a.plannedStart || !a.plannedEnd) continue; // can't bucket without dates
      const dist = distributeAssignmentByDay({
        plannedStart: toIsoDate(a.plannedStart),
        plannedEnd: toIsoDate(a.plannedEnd),
        plannedHours: a.plannedHours,
        maxHoursPerDay: args.user.maxHoursPerDay,
        includeWeekends: false,
      });
      for (const [iso, hours] of dist) {
        existingDailyLoad.set(iso, (existingDailyLoad.get(iso) ?? 0) + hours);
      }
    }
    const dailyWarn = checkDailyOverload({
      user: { fullName: args.user.fullName, maxHoursPerDay: args.user.maxHoursPerDay },
      existingDailyLoad,
      addedDailyLoad: args.addedDailyLoad,
    });
    if (dailyWarn) warnings.push(dailyWarn);

    // 4. Dependencies — task.dependsOn relates TaskDependency rows; each
    //    carries .dependsOn = the prerequisite Task with its current assignment.
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
