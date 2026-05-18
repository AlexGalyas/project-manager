import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SkillCreateInput, SkillDto, SkillUpdateInput } from '@workforce/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<SkillDto[]> {
    const skills = await this.prisma.skill.findMany({
      where: { organizationId },
      include: { _count: { select: { users: true, tasks: true } } },
      orderBy: { name: 'asc' },
    });
    return skills.map((s) => ({
      id: s.id,
      name: s.name,
      usage: { users: s._count.users, tasks: s._count.tasks },
    }));
  }

  async create(organizationId: string, input: SkillCreateInput): Promise<SkillDto> {
    try {
      const created = await this.prisma.skill.create({
        data: { organizationId, name: input.name },
        include: { _count: { select: { users: true, tasks: true } } },
      });
      return {
        id: created.id,
        name: created.name,
        usage: { users: created._count.users, tasks: created._count.tasks },
      };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({
          message: `A skill named "${input.name}" already exists in this organization.`,
          error: 'SKILL_NAME_TAKEN',
        });
      }
      throw e;
    }
  }

  async update(
    organizationId: string,
    id: string,
    input: SkillUpdateInput,
  ): Promise<SkillDto> {
    const existing = await this.prisma.skill.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('skill not found');

    try {
      const updated = await this.prisma.skill.update({
        where: { id },
        data: { name: input.name },
        include: { _count: { select: { users: true, tasks: true } } },
      });
      return {
        id: updated.id,
        name: updated.name,
        usage: { users: updated._count.users, tasks: updated._count.tasks },
      };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({
          message: `A skill named "${input.name}" already exists in this organization.`,
          error: 'SKILL_NAME_TAKEN',
        });
      }
      throw e;
    }
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const existing = await this.prisma.skill.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('skill not found');
    // Cascade on UserSkill and TaskSkill is set in the schema — Prisma drops
    // those rows automatically.
    await this.prisma.skill.delete({ where: { id } });
  }
}
