export type AuthRole = 'CUSTOMER' | 'STAFF' | 'ADMIN';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface AuthUserResponse {
  userId: string;
  fullName: string;
  email?: string;
  role: AuthRole;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUserResponse;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export interface AuthApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface AuthApiSuccess<T> {
  success: true;
  data: T;
}