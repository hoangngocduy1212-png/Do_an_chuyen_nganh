import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';

interface TestAccount {
  email: string;
  password: string;
  refreshToken: string;
  accessToken: string;
}

describe('Auth endpoints (e2e)', () => {
  let app: INestApplication;
  const accounts = new Map<string, TestAccount>();
  const tokens = new Map<string, string>();
  const authService = {
    register: jest.fn(async (body: { email: string; password: string }) => {
      const account = { email: body.email, password: body.password, accessToken: 'access-1', refreshToken: 'refresh-1' };
      accounts.set(body.email, account);
      tokens.set(account.refreshToken, body.email);
      return { accessToken: account.accessToken, refreshToken: account.refreshToken, user: { userId: 'user-1', fullName: 'Khách thử', role: 'CUSTOMER' } };
    }),
    login: jest.fn(async (body: { email: string; password: string }) => {
      const account = accounts.get(body.email);
      if (!account || account.password !== body.password) throw new Error('Thông tin đăng nhập không hợp lệ');
      tokens.delete(account.refreshToken);
      const next = { ...account, accessToken: 'access-2', refreshToken: 'refresh-2' };
      accounts.set(body.email, next);
      tokens.set(next.refreshToken, body.email);
      return { accessToken: next.accessToken, refreshToken: next.refreshToken, user: { userId: 'user-1', fullName: 'Khách thử', role: 'CUSTOMER' } };
    }),
    refresh: jest.fn(async (body: { refreshToken: string }) => {
      const email = tokens.get(body.refreshToken);
      if (!email) throw new Error('Refresh token không hợp lệ');
      tokens.delete(body.refreshToken);
      const account = accounts.get(email)!;
      const next = { ...account, accessToken: 'access-3', refreshToken: 'refresh-3' };
      accounts.set(email, next);
      tokens.set(next.refreshToken, email);
      return { accessToken: next.accessToken, refreshToken: next.refreshToken, user: { userId: 'user-1', fullName: 'Khách thử', role: 'CUSTOMER' } };
    }),
    logout: jest.fn(async (body: { refreshToken?: string }) => {
      if (body.refreshToken) tokens.delete(body.refreshToken);
      return { message: 'Đã đăng xuất' };
    }),
    forgotPassword: jest.fn(async () => ({ message: 'Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi' })),
    resetPassword: jest.fn(async () => ({ message: 'Đặt lại mật khẩu thành công' })),
  };

  beforeAll(async () => {
    const testModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }])],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: { userId: string; role: string } } } }) => {
              context.switchToHttp().getRequest().user = { userId: 'user-1', role: 'CUSTOMER' };
              return true;
            },
          },
        },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();
    app = testModule.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  afterAll(async () => app.close());

  it('chạy luồng register → login → refresh → logout', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ fullName: 'Khách thử', email: 'test@example.com', phone: '0901234567', password: 'TestPass123' })
      .expect(201);
    expect(registerResponse.body.data.accessToken).toBe('access-1');

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'TestPass123' })
      .expect(200);
    expect(loginResponse.body.data.refreshToken).toBe('refresh-2');

    const refreshResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'refresh-2' })
      .expect(200);
    expect(refreshResponse.body.data.refreshToken).toBe('refresh-3');

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: 'refresh-3' })
      .expect(200);
    expect(tokens.has('refresh-3')).toBe(false);
  });
});
