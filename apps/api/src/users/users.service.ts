import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type {
  UserCreateInput,
  UserSetSkillsInput,
  UserSummaryDto,
  UserUpdateInput,
} from '@workforce/shared';
import { PrismaService } from '../prisma/prisma.service';

type UserWithSkills = Prisma.UserGetPayload<{
  include: { skills: { include: { skill: true } } };
}>;

function toDto(u: UserWithSkills): UserSummaryDto {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    maxHoursPerWeek: u.maxHoursPerWeek,
    maxHoursPerDay: u.maxHoursPerDay,
    skills: u.skills.map((us) => ({
      skillId: us.skillId,
      name: us.skill.name,
      level: us.level,
    })),
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<UserSummaryDto[]> {
    const users = await this.prisma.user.findMany({
      where: { organizationId },
      include: { skills: { include: { skill: true } } },
      orderBy: [{ fullName: 'asc' }],
    });
    return users.map(toDto);
  }

  async findById(userId: string, organizationId: string): Promise<UserSummaryDto> {
    const u = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
      include: { skills: { include: { skill: true } } },
    });
    if (!u) throw new NotFoundException('user not found');
    return toDto(u);
  }

  async create(organizationId: string, input: UserCreateInput): Promise<UserSummaryDto> {
    await this.ensureSkillsInOrg(organizationId, input.skillIds ?? []);

    const passwordHash = await bcrypt.hash(input.password, 10);
    try {
      const created = await this.prisma.user.create({
        data: {
          organizationId,
          email: input.email,
          fullName: input.fullName,
          passwordHash,
          role: input.role,
          maxHoursPerWeek: input.maxHoursPerWeek,
          maxHoursPerDay: input.maxHoursPerDay,
          skills: {
            create: (input.skillIds ?? []).map((skillId) => ({ skillId })),
          },
        },
        include: { skills: { include: { skill: true } } },
      });
      return toDto(created);
    } catch (e) {
      throw this.mapPrismaError(e, input.email);
    }
  }

  async update(
    callerUserId: string,
    organizationId: string,
    targetUserId: string,
    input: UserUpdateInput,
  ): Promise<UserSummaryDto> {
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundException('user not found');

    const isSelf = callerUserId === targetUserId;

    if (input.role !== undefined && input.role !== target.role) {
      if (isSelf) {
        throw new ForbiddenException({
          message: 'Admins cannot change their own role.',
          error: 'CANNOT_EDIT_OWN_ROLE',
        });
      }
      if (target.role === Role.ADMIN && input.role !== Role.ADMIN) {
        await this.ensureNotLastAdmin(organizationId);
      }
    }

    if (input.skillIds !== undefined) {
      await this.ensureSkillsInOrg(organizationId, input.skillIds);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: targetUserId },
          data: {
            ...(input.email !== undefined ? { email: input.email } : {}),
            ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
            ...(input.role !== undefined ? { role: input.role } : {}),
            ...(input.maxHoursPerWeek !== undefined
              ? { maxHoursPerWeek: input.maxHoursPerWeek }
              : {}),
            ...(input.maxHoursPerDay !== undefined
              ? { maxHoursPerDay: input.maxHoursPerDay }
              : {}),
          },
        });
        if (input.skillIds !== undefined) {
          await tx.userSkill.deleteMany({ where: { userId: targetUserId } });
          if (input.skillIds.length > 0) {
            await tx.userSkill.createMany({
              data: input.skillIds.map((skillId) => ({ userId: targetUserId, skillId })),
            });
          }
        }
      });
    } catch (e) {
      throw this.mapPrismaError(e, input.email ?? '');
    }

    const fresh = await this.prisma.user.findUniqueOrThrow({
      where: { id: targetUserId },
      include: { skills: { include: { skill: true } } },
    });
    return toDto(fresh);
  }

  async delete(callerUserId: string, organizationId: string, targetUserId: string): Promise<void> {
    if (callerUserId === targetUserId) {
      throw new ForbiddenException({
        message: 'You cannot delete your own account.',
        error: 'CANNOT_DELETE_SELF',
      });
    }
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundException('user not found');

    if (target.role === Role.ADMIN) {
      await this.ensureNotLastAdmin(organizationId);
    }
    // Cascade on Assignment.userId is set in the schema — Prisma deletes the
    // user's assignments automatically.
    await this.prisma.user.delete({ where: { id: targetUserId } });
  }

  async changePassword(
    organizationId: string,
    targetUserId: string,
    newPassword: string,
  ): Promise<void> {
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('user not found');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { passwordHash },
    });
  }

  async setSkills(
    organizationId: string,
    targetUserId: string,
    input: UserSetSkillsInput,
  ): Promise<UserSummaryDto> {
    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('user not found');

    await this.ensureSkillsInOrg(organizationId, input.skillIds);

    await this.prisma.$transaction(async (tx) => {
      await tx.userSkill.deleteMany({ where: { userId: targetUserId } });
      if (input.skillIds.length > 0) {
        await tx.userSkill.createMany({
          data: input.skillIds.map((skillId) => ({ userId: targetUserId, skillId })),
        });
      }
    });

    const fresh = await this.prisma.user.findUniqueOrThrow({
      where: { id: targetUserId },
      include: { skills: { include: { skill: true } } },
    });
    return toDto(fresh);
  }

  private async ensureNotLastAdmin(organizationId: string) {
    const adminCount = await this.prisma.user.count({
      where: { organizationId, role: Role.ADMIN },
    });
    if (adminCount <= 1) {
      throw new ForbiddenException({
        message: 'Cannot remove the last administrator from the organization.',
        error: 'LAST_ADMIN',
      });
    }
  }

  private async ensureSkillsInOrg(organizationId: string, skillIds: string[]) {
    if (skillIds.length === 0) return;
    const dedup = Array.from(new Set(skillIds));
    if (dedup.length !== skillIds.length) {
      throw new BadRequestException('skillIds contains duplicates');
    }
    const count = await this.prisma.skill.count({
      where: { id: { in: skillIds }, organizationId },
    });
    if (count !== skillIds.length) {
      throw new BadRequestException('one or more skillIds do not belong to this organization');
    }
  }

  private mapPrismaError(e: unknown, attemptedEmail: string): unknown {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const target = (e.meta as { target?: string[] } | undefined)?.target;
      if (target && target.includes('email')) {
        return new ConflictException({
          message: `The email "${attemptedEmail}" is already in use.`,
          error: 'EMAIL_TAKEN',
        });
      }
    }
    return e;
  }
}
