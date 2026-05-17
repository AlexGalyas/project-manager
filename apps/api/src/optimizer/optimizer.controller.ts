import { Body, Controller, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ZodValidationPipe } from 'nestjs-zod';
import { OptimizerRunInputSchema, type OptimizerRunInput } from '@workforce/shared';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUserContext } from '../auth/jwt-payload.interface';
import { OptimizerService } from './optimizer.service';

@Controller('optimizer')
export class OptimizerController {
  constructor(private readonly optimizer: OptimizerService) {}

  @Post('run')
  @Roles(Role.ADMIN, Role.MANAGER)
  run(
    @CurrentUser() user: CurrentUserContext,
    @Body(new ZodValidationPipe(OptimizerRunInputSchema)) body: OptimizerRunInput,
  ) {
    return this.optimizer.run(user.organizationId, body);
  }
}
