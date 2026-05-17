import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { WorkloadEntryDto, WorkloadStatus } from '@workforce/shared';
import { PrismaService } from '../prisma/prisma.service';

function classify(plannedHours: number, maxHours: number): WorkloadStatus {
  if (maxHours <= 0) return 'normal';
  const ratio = plannedHours / maxHours;
  if (ratio > 1) return 'over';
  if (ratio >= 0.8) return 'normal';
  return 'under';
}

@Injectable()
export class WorkloadService {
  constructor(private readonly prisma: PrismaService) {}

  async listForOrg(organizationId: string): Promise<WorkloadEntryDto[]> {
    // Sum planned hours per employee.
    const employees = await this.prisma.user.findMany({
      where: { organizationId, role: Role.EMPLOYEE },
      select: { id: true, fullName: true, maxHoursPerWeek: true },
      orderBy: { fullName: 'asc' },
    });

    const sums = await this.prisma.assignment.groupBy({
      by: ['userId'],
      where: { user: { organizationId, role: Role.EMPLOYEE } },
      _sum: { plannedHours: true },
    });

    const sumByUser = new Map<string, number>();
    for (const row of sums) {
      sumByUser.set(row.userId, row._sum.plannedHours ?? 0);
    }

    return employees.map((u) => {
      const planned = sumByUser.get(u.id) ?? 0;
      return {
        userId: u.id,
        fullName: u.fullName,
        plannedHours: planned,
        maxHours: u.maxHoursPerWeek,
        status: classify(planned, u.maxHoursPerWeek),
      };
    });
  }

  async forUser(userId: string, organizationId: string): Promise<WorkloadEntryDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: { id: true, fullName: true, maxHoursPerWeek: true },
    });
    if (!user) throw new NotFoundException('user not found');

    const sum = await this.prisma.assignment.aggregate({
      where: { userId, user: { organizationId } },
      _sum: { plannedHours: true },
    });
    const planned = sum._sum.plannedHours ?? 0;

    return {
      userId: user.id,
      fullName: user.fullName,
      plannedHours: planned,
      maxHours: user.maxHoursPerWeek,
      status: classify(planned, user.maxHoursPerWeek),
    };
  }
}
