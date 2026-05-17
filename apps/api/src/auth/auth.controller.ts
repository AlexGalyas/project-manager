import { Body, Controller, Get, HttpCode, Post, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { LoginInputSchema, type LoginInput } from '@workforce/shared';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';
import type { CurrentUserContext } from './jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Public()
  @UsePipes(new ZodValidationPipe(LoginInputSchema))
  async login(@Body() body: LoginInput) {
    return this.auth.login(body.email, body.password);
  }

  @Get('me')
  async me(@CurrentUser() user: CurrentUserContext) {
    return this.auth.getProfile(user.userId);
  }
}
