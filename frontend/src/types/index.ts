// Kieu du lieu dung chung, bam theo bao cao muc 3.2.3 va docs/api/API.md
export type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN';

export interface AuthUser {
  userId: string;
  fullName: string;
  email: string;
  role: Role;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: { page: number; limit: number; total: number };
}

export interface ApiError {
  success: false;
  error: { code: string; message: string };
}

export interface Category {
  _id: string;
  categoryName: string;
  description?: string;
}
