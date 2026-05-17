import { Injectable, NotFoundException } from '@nestjs/common';
import type { AssignmentListQuery, AssignmentWithRefsDto } from '@workforce/shared';
import { PrismaService } from '../prisma/prisma.service';

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
        ...(filter.projectId ? { task: { projectId: filter.projectId, project: { organizationId } } } : {}),
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
      createdAt: a.createdAt.toISOString(),
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

  async delete(organizationId: string, id: string): Promise<void> {
    const existing = await this.prisma.assignment.findFirst({
      where: { id, task: { project: { organizationId } } },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('assignment not found');
    await this.prisma.assignment.delete({ where: { id } });
  }
}
