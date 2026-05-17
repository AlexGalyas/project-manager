import type { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  organizationId: string;
  role: Role;
  email: string;
}

export interface CurrentUserContext {
  userId: string;
  organizationId: string;
  role: Role;
  email: string;
}
