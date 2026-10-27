import { HttpException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { Connection, Model } from 'mongoose';
import { ErrorCode } from '../../common/constants/error-codes';
import { Role, UserStatus } from '../../common/constants/roles.enum';
import { Cart } from '../carts/schemas/cart.schema';
import { Customer } from '../customers/schemas/customer.schema';
import { Employee } from '../employees/schemas/employee.schema';
import { MailService } from '../mail/mail.service';
import { Membership } from '../memberships/schemas/membership.schema';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let userMocks: {
    findByEmailWithPassword: jest.Mock;
    findByUserIdWithTokens: jest.Mock;
    addRefreshTokenHash: jest.Mock;
    rotateRefreshTokenHash: jest.Mock;
    revokeAllRefreshTokens: jest.Mock;
    consumeResetToken: jest.Mock;
    setPasswordReset: jest.Mock;
  };
  let mailMocks: { sendPasswordReset: jest.Mock; sendPasswordChanged: jest.Mock };
  let jwtMocks: { signAsync: jest.Mock; verifyAsync: jest.Mock };

  beforeEach(async () => {
    userMocks = {
      findByEmailWithPassword: jest.fn().mockResolvedValue(null),
      findByUserIdWithTokens: jest.fn(),
      addRefreshTokenHash: jest.fn().mockResolvedValue(undefined),
      rotateRefreshTokenHash: jest.fn().mockResolvedValue(true),
      revokeAllRefreshTokens: jest.fn().mockResolvedValue(undefined),
      consumeResetToken: jest.fn().mockResolvedValue(null),
      setPasswordReset: jest.fn().mockResolvedValue(undefined),
    };
    mailMocks = {
      sendPasswordReset: jest.fn().mockResolvedValue(undefined),
      sendPasswordChanged: jest.fn().mockResolvedValue(undefined),
    };
    jwtMocks = {
      signAsync: jest.fn().mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token'),
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', tokenType: 'refresh', jti: 'jti-1' }),
    };
    const configValues: Record<string, string | number> = {
      bcryptCost: 10,
      frontendUrl: 'http://localhost:5173',
      'jwt.accessSecret': 'a'.repeat(40),
      'jwt.refreshSecret': 'b'.repeat(40),
      'jwt.accessExpires': 900,
      'jwt.refreshExpires': 604800,
    };
    const config = { get: (key: string) => configValues[key] };
    const employeeModel = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: userMocks },
        { provide: JwtService, useValue: jwtMocks },
        { provide: ConfigService, useValue: config },
        { provide: MailService, useValue: mailMocks },
        { provide: getConnectionToken(), useValue: {} as Connection },
        { provide: getModelToken(Customer.name), useValue: {} as Model<Customer> },
        { provide: getModelToken(Cart.name), useValue: {} as Model<Cart> },
        { provide: getModelToken(Membership.name), useValue: {} as Model<Membership> },
        { provide: getModelToken(Employee.name), useValue: employeeModel as unknown as Model<Employee> },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('đăng nhập đúng và phát hành cặp token', async () => {
    const hash = await bcrypt.hash('Muadee123', 10);
    userMocks.findByEmailWithPassword.mockResolvedValue({
      userId: 'user-1', fullName: 'Khách hàng', email: 'khach@example.com', role: Role.CUSTOMER,
      status: UserStatus.ACTIVE, password: hash,
    });

    const result = await service.login({ email: 'KHACH@example.com', password: 'Muadee123' });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.user).toEqual({ userId: 'user-1', fullName: 'Khách hàng', role: Role.CUSTOMER });
    expect(userMocks.addRefreshTokenHash).toHaveBeenCalledTimes(1);
    expect(userMocks.findByEmailWithPassword).toHaveBeenCalledWith('khach@example.com');
  });

  it.each([
    ['mật khẩu sai', { userId: 'user-1', fullName: 'Khách', email: 'a@b.com', role: Role.CUSTOMER, status: UserStatus.ACTIVE, password: 'not-a-hash' }],
    ['email không tồn tại', null],
  ])('trả cùng mã INVALID_CREDENTIALS khi %s', async (_caseName, account) => {
    userMocks.findByEmailWithPassword.mockResolvedValue(account);
    const password = account ? 'wrong-password' : 'Muadee123';

    const error = await service.login({ email: 'a@b.com', password }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as HttpException).getResponse()).toMatchObject({ code: ErrorCode.INVALID_CREDENTIALS });
  });

  it('chỉ báo tài khoản khóa sau khi mật khẩu đã đúng', async () => {
    const hash = await bcrypt.hash('Muadee123', 10);
    userMocks.findByEmailWithPassword.mockResolvedValue({
      userId: 'locked', fullName: 'Tài khoản khóa', email: 'locked@example.com', role: Role.CUSTOMER,
      status: UserStatus.LOCKED, password: hash,
    });

    await expect(service.login({ email: 'locked@example.com', password: 'Muadee123' })).rejects.toMatchObject({
      response: { code: ErrorCode.ACCOUNT_LOCKED },
      status: 403,
    });
  });

  it('forgot-password trả cùng thông báo khi email không tồn tại và giới hạn 5 lần theo email/IP', async () => {
    const first = await service.forgotPassword({ email: 'missing@example.com' }, '127.0.0.1');
    expect(first.message).toBe('Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi');
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await service.forgotPassword({ email: 'missing@example.com' }, '127.0.0.1');
    }

    await expect(service.forgotPassword({ email: 'missing@example.com' }, '127.0.0.1')).rejects.toMatchObject({
      response: { code: ErrorCode.TOO_MANY_REQUESTS },
      status: 429,
    });
  });

  it('forgot-password email tồn tại vẫn trả cùng thông báo và gửi mail nền', async () => {
    userMocks.findByEmailWithPassword.mockResolvedValue({
      userId: 'user-1', fullName: 'Khách', email: 'known@example.com', role: Role.CUSTOMER,
      status: UserStatus.ACTIVE, password: 'hash',
    });

    const result = await service.forgotPassword({ email: 'KNOWN@example.com' }, '127.0.0.2');
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(result.message).toBe('Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi');
    expect(userMocks.setPasswordReset).toHaveBeenCalledWith('user-1', expect.any(String), expect.any(Date));
    expect(mailMocks.sendPasswordReset).toHaveBeenCalledWith('known@example.com', expect.stringContaining('/reset-password?token='));
  });

  it.each(['wrong-token', 'expired-token'])(
    'trả INVALID_OR_EXPIRED_TOKEN cho token %s', async (token) => {
      userMocks.consumeResetToken.mockResolvedValue(null);
      await expect(service.resetPassword({ token, newPassword: 'NewPass123' })).rejects.toMatchObject({
        response: { code: ErrorCode.INVALID_OR_EXPIRED_TOKEN },
        status: 400,
      });
    },
  );

  it('chỉ cho reset token dùng một lần và xóa session ở lần hợp lệ', async () => {
    userMocks.consumeResetToken.mockResolvedValueOnce({ email: 'khach@example.com' }).mockResolvedValueOnce(null);
    const dto = { token: 'raw-one-time-token', newPassword: 'NewPass123' };

    await expect(service.resetPassword(dto)).resolves.toEqual({ message: 'Đặt lại mật khẩu thành công' });
    expect(userMocks.consumeResetToken).toHaveBeenCalledWith(expect.any(String), expect.any(Date), expect.any(String));
    expect(mailMocks.sendPasswordChanged).toHaveBeenCalledWith('khach@example.com');
    await expect(service.resetPassword(dto)).rejects.toMatchObject({
      response: { code: ErrorCode.INVALID_OR_EXPIRED_TOKEN },
      status: 400,
    });
  });

  it('thu hồi toàn bộ refresh session khi phát hiện token đã bị tái sử dụng', async () => {
    userMocks.findByUserIdWithTokens.mockResolvedValue({
      userId: 'user-1', fullName: 'Khách', email: 'a@b.com', role: Role.CUSTOMER, status: UserStatus.ACTIVE,
      password: 'hash', refreshTokenHashes: [],
    });

    await expect(service.refresh({ refreshToken: 'signed-valid-refresh-token' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(userMocks.revokeAllRefreshTokens).toHaveBeenCalledWith('user-1');
  });
});
