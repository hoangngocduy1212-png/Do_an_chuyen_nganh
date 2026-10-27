import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Danh dau endpoint khong can dang nhap (GUEST). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
