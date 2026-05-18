import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ZodValidationPipe } from 'nestjs-zod';
import { TaskUpdateInputSchema, type TaskUpdateInput } from '@workforce/shared';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUserContext } from '../auth/jwt-payload.interface';
import { TasksService } from './tasks.service';
import { AssignmentsService } from '../assignments/assignments.service';

@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly assignments: AssignmentsService,
  ) {}

  @Get(':id/assignment')
  getAssignment(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.assignments.getByTaskId(user.organizationId, id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  update(
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(TaskUpdateInputSchema)) body: TaskUpdateInput,
  ) {
    return this.tasks.update(user.organizationId, id, body);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(204)
  async delete(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    await this.tasks.delete(user.organizationId, id);
  }
}
