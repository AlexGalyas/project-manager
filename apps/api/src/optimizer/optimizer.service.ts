import { Injectable, Logger } from '@nestjs/common';
import { AssignmentSource, Role, TaskStatus } from '@prisma/client';
import {
  distributeAssignmentByDay,
  fromIsoDate,
  type IsoDate,
  type OptimizerResultDto,
  type OptimizerRunInput,
} from '@workforce/shared';
import { PrismaService } from '../prisma/prisma.service';
import { GreedyOptimizer } from './strategies/greedy-optimizer';
import type {
  OptimizerEmployeeInput,
  OptimizerStrategy,
  OptimizerTaskInput,
} from './strategies/optimizer-strategy.interface';

const DEFAULT_WEIGHTS = { alpha: 1.0, beta: 2.0, gamma: 0.5 };

@Injectable()
export class OptimizerService {
  private readonly logger = new Logger(OptimizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly greedy: GreedyOptimizer,
  ) {}

  private pickStrategy(): OptimizerStrategy {
    return this.greedy;
  }

  /**
   * Phase 7.5 + Phase 9 (day-level) contract:
   * - Locked + manual assignments are *sacred*. The optimizer never deletes or
   *   modifies them, and their per-day load is pre-loaded into the
   *   employee's dailyLoad so the optimizer respects the daily capacity they
   *   consume.
   * - `replaceExisting: true` only deletes assignments where
   *   `source = OPTIMIZER AND lockedByManager = false` within the scope.
   * - Tasks that already have a non-deleted assignment after the optional
   *   cleanup are skipped (not subject to optimization).
   * - New assignments are persisted with `source: OPTIMIZER, lockedByManager:
   *   false`, with `plannedStart` / `plannedEnd` set to the dates the
   *   optimizer chose.
   */
  async run(organizationId: string, input: OptimizerRunInput): Promise<OptimizerResultDto> {
    const strategy = this.pickStrategy();
    const weights = { ...DEFAULT_WEIGHTS, ...(input.weights ?? {}) };
    const replaceExisting = input.replaceExisting ?? false;
    const includeWeekends = input.includeWeekends ?? false;

    const projectScopeFilter =
      input.projectIds && input.projectIds.length > 0
        ? { id: { in: input.projectIds } }
        : {};

    // 1. Tasks the optimizer might place: TODO, scoped, in org.
    const tasksInScope = await this.prisma.task.findMany({
      where: {
        status: TaskStatus.TODO,
        project: { organizationId, ...projectScopeFilter },
      },
      include: {
        skills: { select: { skillId: true } },
        dependsOn: { select: { dependsOnTaskId: true } },
        assignment: true,
      },
    });
    const scopedTaskIds = tasksInScope.map((t) => t.id);

    let removedCount = 0;

    // 2. Optional cleanup of unlocked OPTIMIZER assignments within scope.
    if (replaceExisting && scopedTaskIds.length > 0) {
      const result = await this.prisma.assignment.deleteMany({
        where: {
          taskId: { in: scopedTaskIds },
          source: AssignmentSource.OPTIMIZER,
          lockedByManager: false,
        },
      });
      removedCount = result.count;
    }

    // 3. Re-read assignments AFTER any cleanup so candidate filtering, initial
    //    daily-load, and end-date lookup see only surviving rows.
    const survivingAssignments = await this.prisma.assignment.findMany({
      where: { task: { project: { organizationId } } },
      select: {
        taskId: true,
        userId: true,
        plannedHours: true,
        plannedStart: true,
        plannedEnd: true,
        source: true,
        lockedByManager: true,
      },
    });

    // 4. Candidate tasks = scoped tasks WITHOUT a surviving assignment.
    const survivingTaskIds = new Set(survivingAssignments.map((a) => a.taskId));
    const candidateTasks = tasksInScope.filter((t) => !survivingTaskIds.has(t.id));

    // 5. Pull employees so we know each user's maxHoursPerDay before we
    //    distribute existing assignments.
    const employees = await this.prisma.user.findMany({
      where: { organizationId, role: Role.EMPLOYEE },
      include: { skills: { select: { skillId: true } } },
    });
    const maxHoursPerDayByUser = new Map<string, number>();
    for (const u of employees) maxHoursPerDayByUser.set(u.id, u.maxHoursPerDay);

    // 6. Build per-user daily-load map from surviving assignments, plus total
    //    weekly load. For assignments without plannedStart/plannedEnd we fall
    //    back to "ad-hoc spread starting today at maxHoursPerDay" so the
    //    optimizer still respects them as consumed capacity.
    const today = new Date();
    const loadByUser = new Map<string, number>();
    const dailyLoadByUser = new Map<string, Map<IsoDate, number>>();
    const existingTaskEndByTask = new Map<string, Date | null>();

    for (const a of survivingAssignments) {
      loadByUser.set(a.userId, (loadByUser.get(a.userId) ?? 0) + a.plannedHours);

      const maxPerDay = maxHoursPerDayByUser.get(a.userId) ?? 8;
      const start = a.plannedStart ?? today;
      const end = a.plannedEnd ?? a.plannedStart ?? today;

      const distribution = distributeAssignmentByDay({
        plannedStart: toIso(start),
        plannedEnd: toIso(end),
        plannedHours: a.plannedHours,
        maxHoursPerDay: maxPerDay,
        includeWeekends,
      });

      let userDaily = dailyLoadByUser.get(a.userId);
      if (!userDaily) {
        userDaily = new Map();
        dailyLoadByUser.set(a.userId, userDaily);
      }
      for (const [iso, hours] of distribution) {
        userDaily.set(iso, (userDaily.get(iso) ?? 0) + hours);
      }

      existingTaskEndByTask.set(a.taskId, a.plannedEnd ?? a.plannedStart ?? null);
    }

    const employeesInput: OptimizerEmployeeInput[] = employees.map((u) => ({
      id: u.id,
      maxHoursPerWeek: u.maxHoursPerWeek,
      maxHoursPerDay: u.maxHoursPerDay,
      skillIds: u.skills.map((s) => s.skillId),
      initialLoadHours: loadByUser.get(u.id) ?? 0,
      initialDailyLoad: dailyLoadByUser.get(u.id) ?? new Map(),
    }));

    const tasksInput: OptimizerTaskInput[] = candidateTasks.map((t) => ({
      id: t.id,
      projectId: t.projectId,
      name: t.name,
      durationHours: t.durationHours,
      priority: t.priority,
      deadline: t.deadline,
      requiredSkillIds: t.skills.map((s) => s.skillId),
      dependsOnIds: t.dependsOn.map((d) => d.dependsOnTaskId),
    }));

    const preAssignedTaskIds = new Set(survivingAssignments.map((a) => a.taskId));
    const existingAssignmentByTask = new Map(
      survivingAssignments.map((a) => [a.taskId, a.userId] as const),
    );

    const lockedCount = survivingAssignments.filter((a) => a.lockedByManager).length;
    const preservedCount = survivingAssignments.length;

    this.logger.log(
      `running ${strategy.name} on org=${organizationId}: ` +
        `${candidateTasks.length} candidate tasks, ${employeesInput.length} employees, ` +
        `replaceExisting=${replaceExisting}, includeWeekends=${includeWeekends}, ` +
        `removed=${removedCount}, preserved=${preservedCount} (locked=${lockedCount})`,
    );

    const result = await strategy.optimize({
      tasks: tasksInput,
      employees: employeesInput,
      preAssignedTaskIds,
      existingAssignmentByTask,
      existingTaskEndByTask,
      weights,
      includeWeekends,
      now: today,
    });

    // 7. Persist new assignments with plannedStart / plannedEnd from the
    //    optimizer's day-level placement.
    if (result.assignments.length > 0) {
      await this.prisma.$transaction(
        result.assignments.map((a) =>
          this.prisma.assignment.create({
            data: {
              taskId: a.taskId,
              userId: a.userId,
              plannedHours: a.plannedHours,
              plannedStart: fromIsoDate(a.plannedStart),
              plannedEnd: fromIsoDate(a.plannedEnd),
              source: AssignmentSource.OPTIMIZER,
              lockedByManager: false,
            },
          }),
        ),
      );
    }

    return {
      strategy: strategy.name,
      assignments: result.assignments,
      unassigned: result.unassigned,
      preservedCount,
      lockedCount,
      removedCount,
      metrics: result.metrics,
    };
  }
}

function toIso(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}
