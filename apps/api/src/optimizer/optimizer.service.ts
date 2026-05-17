import { Injectable, Logger } from '@nestjs/common';
import { Role, TaskStatus } from '@prisma/client';
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
    // Single MVP strategy. A future ADR may introduce a registry; for now
    // GreedyOptimizer is the only choice. Adding more strategies = wire them
    // into OptimizerModule and switch here on a body-driven field.
    return this.greedy;
  }

  async run(organizationId: string, input: OptimizerRunInput): Promise<OptimizerResultDto> {
    const strategy = this.pickStrategy();
    const weights = { ...DEFAULT_WEIGHTS, ...(input.weights ?? {}) };

    // Pull the candidate tasks (TODO only — DONE/IN_PROGRESS are out of scope
    // for fresh planning) scoped by org, filtered by projectIds if given.
    const taskWhere: {
      project: { organizationId: string; id?: { in: string[] } };
      status: TaskStatus;
    } = {
      project: { organizationId },
      status: TaskStatus.TODO,
    };
    if (input.projectIds && input.projectIds.length > 0) {
      taskWhere.project.id = { in: input.projectIds };
    }

    const candidateTasks = await this.prisma.task.findMany({
      where: taskWhere,
      include: {
        skills: { select: { skillId: true } },
        dependsOn: { select: { dependsOnTaskId: true } },
      },
    });

    const employees = await this.prisma.user.findMany({
      where: { organizationId, role: Role.EMPLOYEE },
      include: { skills: { select: { skillId: true } } },
    });

    // Existing assignments matter for two reasons:
    //  (a) they prefill load[] so we don't overcommit existing planning.
    //  (b) they let a dep on an IN_PROGRESS task count as satisfied.
    const existing = await this.prisma.assignment.findMany({
      where: { task: { project: { organizationId } } },
      select: { taskId: true, userId: true, plannedHours: true },
    });

    if (input.replaceExisting) {
      // Wipe assignments for tasks within the planning scope so the optimizer
      // gets a clean slate. (Assignments for other projects or for
      // IN_PROGRESS/DONE tasks are left intact.)
      const taskIdsInScope = candidateTasks.map((t) => t.id);
      if (taskIdsInScope.length > 0) {
        await this.prisma.assignment.deleteMany({
          where: { taskId: { in: taskIdsInScope } },
        });
      }
    }

    // Recompute initial load with the (possibly trimmed) set of existing
    // assignments.
    const remainingExisting = input.replaceExisting
      ? existing.filter((e) => !candidateTasks.some((t) => t.id === e.taskId))
      : existing;

    const loadByUser = new Map<string, number>();
    for (const a of remainingExisting) {
      loadByUser.set(a.userId, (loadByUser.get(a.userId) ?? 0) + a.plannedHours);
    }

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

    const preAssignedTaskIds = new Set(remainingExisting.map((e) => e.taskId));
    const existingAssignmentByTask = new Map(
      remainingExisting.map((e) => [e.taskId, e.userId] as const),
    );

    this.logger.log(
      `running ${strategy.name} optimizer on org=${organizationId}: ${tasksInput.length} tasks, ${employeesInput.length} employees, replaceExisting=${input.replaceExisting}`,
    );

    const result = await strategy.optimize({
      tasks: tasksInput,
      employees: employeesInput,
      preAssignedTaskIds,
      existingAssignmentByTask,
      weights,
      now: new Date(),
    });

    // Persist transactionally.
    if (result.assignments.length > 0) {
      await this.prisma.$transaction(
        result.assignments.map((a) =>
          this.prisma.assignment.upsert({
            where: { taskId: a.taskId },
            create: {
              taskId: a.taskId,
              userId: a.userId,
              plannedHours: a.plannedHours,
            },
            update: {
              userId: a.userId,
              plannedHours: a.plannedHours,
            },
          }),
        ),
      );
    }

    return {
      strategy: strategy.name,
      assignments: result.assignments,
      unassigned: result.unassigned,
      metrics: result.metrics,
    };
  }
}
