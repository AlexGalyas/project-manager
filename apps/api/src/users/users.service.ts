import { Injectable, NotFoundException } from '@nestjs/common';
import type { UserSummaryDto } from '@workforce/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<UserSummaryDto[]> {
    const users = await this.prisma.user.findMany({
      where: { organizationId },
      include: { skills: { include: { skill: true } } },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      maxHoursPerWeek: u.maxHoursPerWeek,
      skills: u.skills.map((us) => ({ skillId: us.skillId, name: us.skill.name, level: us.level })),
    }));
  }

  async findById(userId: string, organizationId: string): Promise<UserSummaryDto> {
    const u = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
      include: { skills: { include: { skill: true } } },
    });
    if (!u) throw new NotFoundException('user not found');
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      maxHoursPerWeek: u.maxHoursPerWeek,
      skills: u.skills.map((us) => ({ skillId: us.skillId, name: us.skill.name, level: us.level })),
    };
  }
}
