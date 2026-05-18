import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  UserCreateInputSchema,
  UserPasswordChangeInputSchema,
  UserSetSkillsInputSchema,
  UserUpdateInputSchema,
  type UserCreateInput,
  type UserPasswordChangeInput,
  type UserSetSkillsInput,
  type UserUpdateInput,
} from '@workforce/shared';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUserContext } from '../auth/jwt-payload.interface';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: CurrentUserContext) {
    return this.users.findById(user.userId, user.organizationId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER)
  list(@CurrentUser() user: CurrentUserContext) {
    return this.users.list(user.organizationId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  detail(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.users.findById(id, user.organizationId);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(
    @CurrentUser() user: CurrentUserContext,
    @Body(new ZodValidationPipe(UserCreateInputSchema)) body: UserCreateInput,
  ) {
    return this.users.create(user.organizationId, body);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UserUpdateInputSchema)) body: UserUpdateInput,
  ) {
    return this.users.update(user.userId, user.organizationId, id, body);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(204)
  async delete(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    await this.users.delete(user.userId, user.organizationId, id);
  }

  @Patch(':id/password')
  @Roles(Role.ADMIN)
  @HttpCode(204)
  async changePassword(
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UserPasswordChangeInputSchema)) body: UserPasswordChangeInput,
  ) {
    await this.users.changePassword(user.organizationId, id, body.password);
  }

  @Put(':id/skills')
  @Roles(Role.ADMIN)
  setSkills(
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UserSetSkillsInputSchema)) body: UserSetSkillsInput,
  ) {
    return this.users.setSkills(user.organizationId, id, body);
  }
}
