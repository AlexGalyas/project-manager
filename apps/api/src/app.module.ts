import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { UsersModule } from './users/users.module';
import { SkillsModule } from './skills/skills.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { OptimizerModule } from './optimizer/optimizer.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    SkillsModule,
    ProjectsModule,
    TasksModule,
    AssignmentsModule,
    OptimizerModule,
  ],
  controllers: [HealthController],
  // Guard order matters: JwtAuthGuard must populate req.user before RolesGuard reads it.
  // Routes opt out of auth with @Public(); roles default to "any authenticated user".
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
