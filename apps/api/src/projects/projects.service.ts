import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ProjectCreateInput,
  ProjectDto,
  ProjectUpdateInput,
  ProjectWithTasksDto,
  TaskDto,
} from '@workforce/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type TaskWithRelations = Prisma.TaskGetPayload<{
  include: {
    skills: { include: { skill: true } };
    dependsOn: true;
    assignment: true;
  };
}>;

function serializeTask(task: TaskWithRelations): TaskDto {
  return {
    id: task.id,
    projectId: task.projectId,
    name: task.name,
    durationHours: task.durationHours,
    deadline: task.deadline ? task.deadline.toISOString() : null,
    priority: task.priority,
    status: task.status,
    skills: task.skills.map((ts) => ({ skillId: ts.skillId, name: ts.skill.name })),
    dependsOnIds: task.dependsOn.map((d) => d.dependsOnTaskId),
    assignment: task.assignment
      ? {
          id: task.assignment.id,
          taskId: task.assignment.taskId,
          userId: task.assignment.userId,
          plannedHours: task.assignment.plannedHours,
          plannedStart: task.assignment.plannedStart ? task.assignment.plannedStart.toISOString() : null,
          plannedEnd: task.assignment.plannedEnd ? task.assignment.plannedEnd.toISOString() : null,
          source: task.assignment.source,
          lockedByManager: task.assignment.lockedByManager,
          createdAt: task.assignment.createdAt.toISOString(),
          updatedAt: task.assignment.updatedAt.toISOString(),
        }
      : null,
  };
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<ProjectDto[]> {
    const projects = await this.prisma.project.findMany({
      where: { organizationId },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { tasks: true } } },
    });
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      priority: p.priority,
      startDate: p.startDate ? p.startDate.toISOString() : null,
      endDate: p.endDate ? p.endDate.toISOString() : null,
      taskCount: p._count.tasks,
    }));
  }

  async create(organizationId: string, input: ProjectCreateInput): Promise<ProjectDto> {
    const created = await this.prisma.project.create({
      data: {
        organizationId,
        name: input.name,
        description: input.description ?? null,
        priority: input.priority ?? 3,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
      },
      include: { _count: { select: { tasks: true } } },
    });
    return {
      id: created.id,
      name: created.name,
      description: created.description,
      priority: created.priority,
      startDate: created.startDate ? created.startDate.toISOString() : null,
      endDate: created.endDate ? created.endDate.toISOString() : null,
      taskCount: created._count.tasks,
    };
  }

  async detail(organizationId: string, id: string): Promise<ProjectWithTasksDto> {
    const project = await this.prisma.project.findFirst({
      where: { id, organizationId },
      include: {
        tasks: {
          include: {
            skills: { include: { skill: true } },
            dependsOn: true,
            assignment: true,
          },
          orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
        },
        _count: { select: { tasks: true } },
      },
    });
    if (!project) throw new NotFoundException('project not found');

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      priority: project.priority,
      startDate: project.startDate ? project.startDate.toISOString() : null,
      endDate: project.endDate ? project.endDate.toISOString() : null,
      taskCount: project._count.tasks,
      tasks: project.tasks.map(serializeTask),
    };
  }

  async update(
    organizationId: string,
    id: string,
    input: ProjectUpdateInput,
  ): Promise<ProjectDto> {
    const existing = await this.prisma.project.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('project not found');

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.startDate !== undefined
          ? { startDate: input.startDate ? new Date(input.startDate) : null }
          : {}),
        ...(input.endDate !== undefined
          ? { endDate: input.endDate ? new Date(input.endDate) : null }
          : {}),
      },
      include: { _count: { select: { tasks: true } } },
    });
    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      priority: updated.priority,
      startDate: updated.startDate ? updated.startDate.toISOString() : null,
      endDate: updated.endDate ? updated.endDate.toISOString() : null,
      taskCount: updated._count.tasks,
    };
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const existing = await this.prisma.project.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('project not found');
    await this.prisma.project.delete({ where: { id } });
  }
}

export { serializeTask };
