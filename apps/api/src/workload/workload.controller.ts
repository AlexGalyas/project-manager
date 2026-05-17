import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUserContext } from '../auth/jwt-payload.interface';
import { WorkloadService } from './workload.service';

@Controller('workload')
export class WorkloadController {
  constructor(private readonly workload: WorkloadService) {}

  @Get('me')
  me(@CurrentUser() user: CurrentUserContext) {
    return this.workload.forUser(user.userId, user.organizationId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER)
  list(@CurrentUser() user: CurrentUserContext) {
    return this.workload.listForOrg(user.organizationId);
  }
}
