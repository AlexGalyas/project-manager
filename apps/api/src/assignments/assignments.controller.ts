import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  AssignmentCreateInputSchema,
  AssignmentListQuerySchema,
  AssignmentUpdateInputSchema,
  type AssignmentCreateInput,
  type AssignmentListQuery,
  type AssignmentUpdateInput,
} from '@workforce/shared';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUserContext } from '../auth/jwt-payload.interface';
import { AssignmentsService } from './assignments.service';

@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Get()
  list(
    @CurrentUser() user: CurrentUserContext,
    @Query(new ZodValidationPipe(AssignmentListQuerySchema)) query: AssignmentListQuery,
  ) {
    // Employees can only see their own assignments; ignore any userId they pass in.
    const filter: AssignmentListQuery =
      user.role === Role.EMPLOYEE ? { ...query, userId: user.userId } : query;
    return this.assignments.list(user.organizationId, filter);
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  create(
    @CurrentUser() user: CurrentUserContext,
    @Body(new ZodValidationPipe(AssignmentCreateInputSchema)) body: AssignmentCreateInput,
  ) {
    return this.assignments.create(user.organizationId, body);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  update(
    @CurrentUser() user: CurrentUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AssignmentUpdateInputSchema)) body: AssignmentUpdateInput,
  ) {
    return this.assignments.update(user.organizationId, id, body);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(204)
  async delete(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    await this.assignments.delete(user.organizationId, id);
  }

  @Post(':id/lock')
  @Roles(Role.ADMIN, Role.MANAGER)
  lock(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.assignments.setLock(user.organizationId, id, true);
  }

  @Post(':id/unlock')
  @Roles(Role.ADMIN, Role.MANAGER)
  unlock(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    return this.assignments.setLock(user.organizationId, id, false);
  }
}
