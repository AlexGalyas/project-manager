import { Injectable } from '@nestjs/common';
import type { SkillDto } from '@workforce/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<SkillDto[]> {
    const skills = await this.prisma.skill.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
    return skills.map((s) => ({ id: s.id, name: s.name }));
  }
}
