import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule],
  controllers: [HealthController],
  providers: [
    // JwtAuthGuard runs globally; @Public-style opt-out is handled by NOT applying it
    // here and applying it per-controller instead. For Phase 2 we keep the explicit
    // @UseGuards on protected routes for clarity; the global one below is reserved
    // for Phase 3 when most routes need auth.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
