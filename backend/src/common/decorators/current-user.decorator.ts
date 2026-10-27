import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '../constants/roles';

export interface AuthUser {
  userId: string;
  role: Role;
}

/** Lay user dang dang nhap tu JWT: @CurrentUser() user: AuthUser */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
