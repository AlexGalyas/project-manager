import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { TaskCreateInput, TaskDto, TaskUpdateInput } from '@workforce/shared';
import { PrismaService } from '../prisma/prisma.service';
import { serializeTask } from '../projects/projects.service';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async listForProject(organizationId: string, projectId: string): Promise<TaskDto[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('project not found');

    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      include: {
        skills: { include: { skill: true } },
        dependsOn: true,
        assignment: true,
      },
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }],
    });
    return tasks.map(serializeTask);
  }

  async create(
    organizationId: string,
    projectId: string,
    input: TaskCreateInput,
  ): Promise<TaskDto> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('project not found');

    await this.ensureSkillsInOrg(organizationId, input.skillIds ?? []);
    await this.ensureDepsInProject(projectId, input.dependsOnIds ?? []);

    const task = await this.prisma.task.create({
      data: {
        projectId,
        name: input.name,
        durationHours: input.durationHours,
        deadline: input.deadline ? new Date(input.deadline) : null,
        priority: input.priority ?? 3,
        status: input.status ?? 'TODO',
        skills: {
          create: (input.skillIds ?? []).map((skillId) => ({ skillId })),
        },
        dependsOn: {
          create: (input.dependsOnIds ?? []).map((dependsOnTaskId) => ({ dependsOnTaskId })),
        },
      },
      include: {
        skills: { include: { skill: true } },
        dependsOn: true,
        assignment: true,
      },
    });

    return serializeTask(task);
  }

  async update(organizationId: string, id: string, input: TaskUpdateInput): Promise<TaskDto> {
    const task = await this.prisma.task.findFirst({
      where: { id, project: { organizationId } },
      select: { id: true, projectId: true },
    });
    if (!task) throw new NotFoundException('task not found');

    if (input.skillIds !== undefined) {
      await this.ensureSkillsInOrg(organizationId, input.skillIds);
    }
    if (input.dependsOnIds !== undefined) {
      await this.ensureDepsInProject(task.projectId, input.dependsOnIds, id);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.durationHours !== undefined ? { durationHours: input.durationHours } : {}),
          ...(input.deadline !== undefined
            ? { deadline: input.deadline ? new Date(input.deadline) : null }
            : {}),
          ...(input.priority !== undefined ? { priority: input.priority } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
      });
      if (input.skillIds !== undefined) {
        await tx.taskSkill.deleteMany({ where: { taskId: id } });
        if (input.skillIds.length > 0) {
          await tx.taskSkill.createMany({
            data: input.skillIds.map((skillId) => ({ taskId: id, skillId })),
          });
        }
      }
      if (input.dependsOnIds !== undefined) {
        await tx.taskDependency.deleteMany({ where: { taskId: id } });
        if (input.dependsOnIds.length > 0) {
          await tx.taskDependency.createMany({
            data: input.dependsOnIds.map((dependsOnTaskId) => ({ taskId: id, dependsOnTaskId })),
          });
        }
      }
    });

    const fresh = await this.prisma.task.findUniqueOrThrow({
      where: { id },
      include: {
        skills: { include: { skill: true } },
        dependsOn: true,
        assignment: true,
      },
    });
    return serializeTask(fresh);
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const task = await this.prisma.task.findFirst({
      where: { id, project: { organizationId } },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('task not found');
    await this.prisma.task.delete({ where: { id } });
  }

  private async ensureSkillsInOrg(organizationId: string, skillIds: string[]) {
    if (skillIds.length === 0) return;
    const count = await this.prisma.skill.count({
      where: { id: { in: skillIds }, organizationId },
    });
    if (count !== skillIds.length) {
      throw new BadRequestException('one or more skillIds do not belong to this organization');
    }
  }

  private async ensureDepsInProject(projectId: string, dependsOnIds: string[], selfId?: string) {
    if (dependsOnIds.length === 0) return;
    if (selfId && dependsOnIds.includes(selfId)) {
      throw new BadRequestException('a task cannot depend on itself');
    }
    const count = await this.prisma.task.count({
      where: { id: { in: dependsOnIds }, projectId },
    });
    if (count !== dependsOnIds.length) {
      throw new BadRequestException('all dependsOnIds must reference tasks within the same project');
    }
  }
}
