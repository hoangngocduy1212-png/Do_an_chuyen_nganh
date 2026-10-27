import { SetMetadata } from '@nestjs/common';
import { Role } from '../constants/roles';

export const ROLES_KEY = 'roles';
/** Gioi han endpoint theo vai tro. Vi du: @Roles(Role.ADMIN, Role.STAFF) */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
