import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ZodValidationPipe } from 'nestjs-zod';
import { AssignmentListQuerySchema, type AssignmentListQuery } from '@workforce/shared';
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

  @Delete(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(204)
  async delete(@CurrentUser() user: CurrentUserContext, @Param('id') id: string) {
    await this.assignments.delete(user.organizationId, id);
  }
}
