import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  SkillCreateInputSchema,
  SkillUpdateInputSchema,
  type SkillCreateInput,
  type SkillUpdateInput,
} from '@workforce/shared';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUserContext } from '../auth/jwt-payload.interface';
import { SkillsService } from './skills.service';

@Controller('skills')
export class SkillsController {
  constructor(private readonly skills: SkillsService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserContext) {
    return this.skills.list(user.organizationId);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(
    @CurrentUser() user: CurrentUserContext,
    @Body(new ZodValidationPipe(SkillCreateInputSchema)) body: SkillCreateInput,
  ) {
    return this.skills.create(user.organizationId, body);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SkillUpdateInputSchema)) body: SkillUpdateInput,
  ) {
    return this.skills.update(user.organizationId, id, body);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(204)
  async delete(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    await this.skills.delete(user.organizationId, id);
  }
}
