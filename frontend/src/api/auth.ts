import axios from 'axios';
import { http } from './client';
import type {
  AuthApiSuccess,
  AuthUserResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  RegisterRequest,
} from '../types/auth';

type LoginPayload = LoginResponse | (Omit<LoginResponse, 'refreshToken'> & { refreshToken?: string });
type ApiResult<T> = AuthApiSuccess<T> | T;

export class AuthRequestError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = 'AuthRequestError';
    this.code = code;
    this.status = status;
  }
}

function unwrap<T extends object>(result: ApiResult<T>): T {
  return 'success' in result && result.success ? result.data : result as T;
}

function throwApiError(error: unknown): never {
  if (axios.isAxiosError<{ error?: { code?: string; message?: string } }>(error)) {
    const status = error.response?.status;
    const body = error.response?.data?.error;
    throw new AuthRequestError(body?.code ?? (status ? `HTTP_${status}` : 'NETWORK_ERROR'), body?.message ?? error.message, status);
  }
  throw error;
}

const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

async function mockLogin(request: LoginRequest): Promise<LoginResponse> {
  await wait(800);
  if (request.email.toLowerCase() === 'locked@test.com') {
    throw new AuthRequestError('ACCOUNT_LOCKED', 'Tài khoản đã bị khóa');
  }
  if (request.password === 'wrongpass1') {
    throw new AuthRequestError('INVALID_CREDENTIALS', 'Thông tin đăng nhập không đúng');
  }
  const role: AuthUserResponse['role'] = request.email.startsWith('admin@')
    ? 'ADMIN'
    : request.email.startsWith('staff@') ? 'STAFF' : 'CUSTOMER';
  return {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    user: { userId: 'mock-user', fullName: 'Khách hàng Muadee', email: request.email, role },
  };
}

export const authApi = {
  async register(request: RegisterRequest): Promise<LoginResponse> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      await wait(800);
      if (request.email.toLowerCase() === 'exists@test.com') {
        throw new AuthRequestError('EMAIL_ALREADY_EXISTS', 'Email này đã được đăng ký');
      }
      return {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: { userId: 'mock-user', fullName: request.fullName, email: request.email, role: 'CUSTOMER' },
      };
    }
    try {
      const { data } = await http.post<ApiResult<LoginResponse>>('/auth/register', request);
      return unwrap(data);
    } catch (error) {
      throwApiError(error);
    }
  },

  async login(request: LoginRequest): Promise<LoginResponse> {
    if (import.meta.env.VITE_USE_MOCK === 'true') return mockLogin(request);
    try {
      const { data } = await http.post<ApiResult<LoginPayload>>('/auth/login', request);
      const payload = unwrap(data);
      return { ...payload, refreshToken: payload.refreshToken ?? '' };
    } catch (error) {
      throwApiError(error);
    }
  },

  async forgotPassword(request: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      await wait(800);
      return { message: 'Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi' };
    }
    try {
      const { data } = await http.post<ApiResult<ForgotPasswordResponse>>('/auth/forgot-password', request);
      return unwrap(data);
    } catch (error) {
      throwApiError(error);
    }
  },

  async resetPassword(request: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      await wait(800);
      if (!request.token || request.token === 'invalid' || request.token === 'expired') {
        throw new AuthRequestError('INVALID_OR_EXPIRED_TOKEN', 'Liên kết đã hết hạn hoặc không hợp lệ', 400);
      }
      return { message: 'Đặt lại mật khẩu thành công' };
    }
    try {
      const { data } = await http.post<ApiResult<ResetPasswordResponse>>('/auth/reset-password', request);
      return unwrap(data);
    } catch (error) {
      throwApiError(error);
    }
  },
};