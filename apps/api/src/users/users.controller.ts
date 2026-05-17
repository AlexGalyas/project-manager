import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
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
}
