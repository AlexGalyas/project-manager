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
  ProjectCreateInputSchema,
  ProjectUpdateInputSchema,
  TaskCreateInputSchema,
  type ProjectCreateInput,
  type ProjectUpdateInput,
  type TaskCreateInput,
} from '@workforce/shared';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUserContext } from '../auth/jwt-payload.interface';
import { ProjectsService } from './projects.service';
import { TasksService } from '../tasks/tasks.service';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly tasks: TasksService,
  ) {}

  @Get()
  list(@CurrentUser() user: CurrentUserContext) {
    return this.projects.list(user.organizationId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  create(
    @CurrentUser() user: CurrentUserContext,
    @Body(new ZodValidationPipe(ProjectCreateInputSchema)) body: ProjectCreateInput,
  ) {
    return this.projects.create(user.organizationId, body);
  }

  @Get(':id')
  detail(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.projects.detail(user.organizationId, id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  update(
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ProjectUpdateInputSchema)) body: ProjectUpdateInput,
  ) {
    return this.projects.update(user.organizationId, id, body);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(204)
  async delete(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    await this.projects.delete(user.organizationId, id);
  }

  @Get(':id/tasks')
  listTasks(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.tasks.listForProject(user.organizationId, id);
  }

  @Post(':id/tasks')
  @Roles(Role.ADMIN, Role.MANAGER)
  createTask(
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(TaskCreateInputSchema)) body: TaskCreateInput,
  ) {
    return this.tasks.create(user.organizationId, id, body);
  }
}
