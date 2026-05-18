import { Injectable, Logger } from '@nestjs/common';
import { AssignmentSource, Role, TaskStatus } from '@prisma/client';
import type { OptimizerResultDto, OptimizerRunInput } from '@workforce/shared';
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
   * Phase 7.5 contract:
   * - Locked + manual assignments are *sacred*. The optimizer never deletes or
   *   modifies them, and their `plannedHours` are pre-loaded into the
   *   employee's load so the optimizer respects the hours they consume.
   * - `replaceExisting: true` only deletes assignments where
   *   `source = OPTIMIZER AND lockedByManager = false` within the scope.
   * - Tasks that already have a non-deleted assignment after the optional
   *   cleanup are skipped (not subject to optimization).
   * - New assignments are persisted with `source: OPTIMIZER, lockedByManager: false`.
   */
  async run(organizationId: string, input: OptimizerRunInput): Promise<OptimizerResultDto> {
    const strategy = this.pickStrategy();
    const weights = { ...DEFAULT_WEIGHTS, ...(input.weights ?? {}) };
    const replaceExisting = input.replaceExisting ?? false;

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

    // 3. Re-read assignments AFTER any cleanup so candidate filtering and
    //    initial-load calculation see the surviving rows.
    const survivingAssignments = await this.prisma.assignment.findMany({
      where: { task: { project: { organizationId } } },
      select: {
        taskId: true,
        userId: true,
        plannedHours: true,
        source: true,
        lockedByManager: true,
      },
    });

    // 4. Candidate tasks = scoped tasks WITHOUT a surviving assignment.
    const survivingTaskIds = new Set(survivingAssignments.map((a) => a.taskId));
    const candidateTasks = tasksInScope.filter((t) => !survivingTaskIds.has(t.id));

    // 5. Initial per-user load = sum of all surviving assignments
    //    (manual + locked + any optimizer rows that weren't cleaned up).
    const loadByUser = new Map<string, number>();
    for (const a of survivingAssignments) {
      loadByUser.set(a.userId, (loadByUser.get(a.userId) ?? 0) + a.plannedHours);
    }

    const employees = await this.prisma.user.findMany({
      where: { organizationId, role: Role.EMPLOYEE },
      include: { skills: { select: { skillId: true } } },
    });
    const employeesInput: OptimizerEmployeeInput[] = employees.map((u) => ({
      id: u.id,
      maxHoursPerWeek: u.maxHoursPerWeek,
      skillIds: u.skills.map((s) => s.skillId),
      initialLoadHours: loadByUser.get(u.id) ?? 0,
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
        `replaceExisting=${replaceExisting}, removed=${removedCount}, preserved=${preservedCount} (locked=${lockedCount})`,
    );

    const result = await strategy.optimize({
      tasks: tasksInput,
      employees: employeesInput,
      preAssignedTaskIds,
      existingAssignmentByTask,
      weights,
      now: new Date(),
    });

    // 6. Persist new assignments. Since candidateTasks had no surviving
    //    assignment, plain `create` works (no upsert needed) — there is no
    //    row to update.
    if (result.assignments.length > 0) {
      await this.prisma.$transaction(
        result.assignments.map((a) =>
          this.prisma.assignment.create({
            data: {
              taskId: a.taskId,
              userId: a.userId,
              plannedHours: a.plannedHours,
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
