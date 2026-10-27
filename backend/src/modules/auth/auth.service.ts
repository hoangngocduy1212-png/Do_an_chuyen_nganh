import { ConflictException, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { Connection, Model } from 'mongoose';
import { ErrorCode } from '../../common/constants/error-codes';
import { Role, UserStatus } from '../../common/constants/roles.enum';
import { Cart } from '../carts/schemas/cart.schema';
import { Customer } from '../customers/schemas/customer.schema';
import { Employee } from '../employees/schemas/employee.schema';
import { MailService } from '../mail/mail.service';
import { Membership } from '../memberships/schemas/membership.schema';
import { User } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

interface AccessPayload {
  sub: string;
  role: Role;
  storeId?: string;
  tokenType: 'access';
}

interface RefreshPayload {
  sub: string;
  tokenType: 'refresh';
  jti: string;
}

interface AuthAccount {
  userId: string;
  fullName: string;
  email: string;
  role: Role;
  status: UserStatus;
  password: string;
  refreshTokenHashes?: Array<{ hash: string; expiresAt: Date }>;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  user: { userId: string; fullName: string; role: Role };
}

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const EMAIL_LIMIT = 5;
const EMAIL_WINDOW_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly emailRequestTimes = new Map<string, number[]>();
  private readonly bcryptCost: number;
  private readonly dummyPasswordHash: string;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Customer.name) private readonly customers: Model<Customer>,
    @InjectModel(Cart.name) private readonly carts: Model<Cart>,
    @InjectModel(Membership.name) private readonly memberships: Model<Membership>,
    @InjectModel(Employee.name) private readonly employees: Model<Employee>,
  ) {
    this.bcryptCost = this.config.get<number>('bcryptCost') ?? 12;
    this.dummyPasswordHash = bcrypt.hashSync(randomBytes(24).toString('hex'), this.bcryptCost);
  }

  async register(dto: RegisterDto): Promise<TokenPair> {
    const email = dto.email.trim().toLowerCase();
    if (await this.users.findByEmailWithPassword(email)) {
      throw new ConflictException({ code: ErrorCode.EMAIL_ALREADY_EXISTS, message: 'Email đã được sử dụng' });
    }

    const userId = randomUUID();
    const customerId = randomUUID();
    const memberCode = `MD${randomBytes(4).toString('hex').toUpperCase()}`;
    const password = await bcrypt.hash(dto.password, this.bcryptCost);
    const userData: Partial<User> = {
      userId,
      fullName: dto.fullName.trim(),
      email,
      phone: dto.phone,
      password,
      role: Role.CUSTOMER,
      status: UserStatus.ACTIVE,
      refreshTokenHashes: [],
    };

    await this.createCustomerRecords(userData, customerId, memberCode);
    return this.issueTokenPair({ userId, fullName: userData.fullName!, email, role: Role.CUSTOMER, status: UserStatus.ACTIVE, password }, undefined);
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.users.findByEmailWithPassword(email) as AuthAccount | null;
    const validPassword = await bcrypt.compare(dto.password, user?.password ?? this.dummyPasswordHash);
    if (!user || !validPassword) {
      throw new UnauthorizedException({ code: ErrorCode.INVALID_CREDENTIALS, message: 'Email hoặc mật khẩu không đúng' });
    }
    if (user.status === UserStatus.LOCKED) {
      throw new HttpException({ code: ErrorCode.ACCOUNT_LOCKED, message: 'Tài khoản đã bị khóa' }, HttpStatus.FORBIDDEN);
    }

    const storeId = user.role === Role.STAFF
      ? (await this.employees.findOne({ userId: user.userId }).select('storeId').lean())?.storeId
      : undefined;
    return this.issueTokenPair(user, storeId);
  }

  async refresh(dto: RefreshDto): Promise<TokenPair> {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const user = await this.users.findByUserIdWithTokens(payload.sub) as AuthAccount | null;
    if (!user) throw this.invalidRefreshToken();
    if (user.status === UserStatus.LOCKED) {
      throw new HttpException({ code: ErrorCode.ACCOUNT_LOCKED, message: 'Tài khoản đã bị khóa' }, HttpStatus.FORBIDDEN);
    }

    const oldHash = this.sha256(dto.refreshToken);
    const isStored = user.refreshTokenHashes?.some((entry) => entry.hash === oldHash && entry.expiresAt > new Date());
    if (!isStored) {
      // JWT hợp lệ nhưng không còn trong DB là token đã bị dùng lại.
      await this.users.revokeAllRefreshTokens(user.userId);
      throw this.invalidRefreshToken();
    }

    const storeId = user.role === Role.STAFF
      ? (await this.employees.findOne({ userId: user.userId }).select('storeId').lean())?.storeId
      : undefined;
    const pair = await this.createTokenPair(user, storeId);
    const rotated = await this.users.rotateRefreshTokenHash(
      user.userId,
      oldHash,
      this.sha256(pair.refreshToken),
      new Date(Date.now() + (this.config.get<number>('jwt.refreshExpires') ?? 604800) * 1000),
    );
    if (!rotated) {
      await this.users.revokeAllRefreshTokens(user.userId);
      throw this.invalidRefreshToken();
    }
    return pair;
  }

  async logout(dto: LogoutDto, userId: string): Promise<{ message: string }> {
    if (!dto.refreshToken) return { message: 'Đã đăng xuất' };
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(dto.refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
      if (payload.tokenType === 'refresh' && payload.sub === userId) {
        await this.users.removeRefreshTokenHash(userId, this.sha256(dto.refreshToken));
      }
    } catch {
      // Logout luôn idempotent, token thiếu/sai không làm lộ trạng thái phiên.
    }
    return { message: 'Đã đăng xuất' };
  }

  async forgotPassword(dto: ForgotPasswordDto, ipAddress: string): Promise<{ message: string }> {
    const email = dto.email.trim().toLowerCase();
    this.enforceEmailLimit(email, ipAddress);
    const response = { message: 'Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi' };
    const user = await this.users.findByEmailWithPassword(email) as AuthAccount | null;
    if (!user || user.status !== UserStatus.ACTIVE) return response;

    const rawToken = randomBytes(32).toString('hex');
    await this.users.setPasswordReset(user.userId, this.sha256(rawToken), new Date(Date.now() + RESET_TOKEN_TTL_MS));
    const frontendUrl = this.config.get<string>('frontendUrl')!;
    const resetUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;
    void this.mail.sendPasswordReset(email, resetUrl).catch(() => {
      this.logger.error('Không gửi được email đặt lại mật khẩu');
    });
    return response;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const password = await bcrypt.hash(dto.newPassword, this.bcryptCost);
    const updatedUser = await this.users.consumeResetToken(this.sha256(dto.token), new Date(), password);
    if (!updatedUser) {
      throw new HttpException(
        { code: ErrorCode.INVALID_OR_EXPIRED_TOKEN, message: 'Liên kết đã hết hạn hoặc không hợp lệ' },
        HttpStatus.BAD_REQUEST,
      );
    }
    void this.mail.sendPasswordChanged(updatedUser.email).catch(() => {
      this.logger.error('Không gửi được email thông báo đổi mật khẩu');
    });
    return { message: 'Đặt lại mật khẩu thành công' };
  }

  private async createCustomerRecords(userData: Partial<User>, customerId: string, memberCode: string): Promise<void> {
    const documents = {
      user: userData,
      customer: { customerId, userId: userData.userId, address: '' },
      cart: { cartId: randomUUID(), customerId, totalAmount: 0 },
      membership: { membershipId: randomUUID(), customerId, memberCode, pointBalance: 0, memberLevel: 'Thường' },
    };
  // Ưu tiên transaction; Mongo standalone sẽ chạy nhánh tạo có cleanup.
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        await this.users.create(documents.user, session);
        await this.customers.create([documents.customer], { session });
        await this.carts.create([documents.cart], { session });
        await this.memberships.create([documents.membership], { session });
      });
      return;
    } catch (error) {
      await this.cleanupAccountRecords(userData.userId!, customerId);
      if (this.isDuplicateKey(error)) {
        throw new ConflictException({ code: ErrorCode.EMAIL_ALREADY_EXISTS, message: 'Email đã được sử dụng' });
      }
      if (!this.isTransactionUnsupported(error)) throw error;
      this.logger.warn('MongoDB không hỗ trợ transaction; dùng đăng ký có cleanup khi lỗi');
    } finally {
      await session.endSession();
    }

    try {
      await this.users.create(documents.user);
      await this.customers.create(documents.customer);
      await this.carts.create(documents.cart);
      await this.memberships.create(documents.membership);
    } catch (error) {
      await this.cleanupAccountRecords(userData.userId!, customerId);
      if (this.isDuplicateKey(error)) {
        throw new ConflictException({ code: ErrorCode.EMAIL_ALREADY_EXISTS, message: 'Email đã được sử dụng' });
      }
      throw error;
    }
  }

  private async cleanupAccountRecords(userId: string, customerId: string): Promise<void> {
    await Promise.all([
      this.memberships.deleteMany({ customerId }),
      this.carts.deleteMany({ customerId }),
      this.customers.deleteMany({ customerId }),
      this.users.deleteByUserId(userId),
    ]);
  }

  private async issueTokenPair(user: AuthAccount, storeId?: string): Promise<TokenPair> {
    const pair = await this.createTokenPair(user, storeId);
    await this.users.addRefreshTokenHash(
      user.userId,
      this.sha256(pair.refreshToken),
      new Date(Date.now() + (this.config.get<number>('jwt.refreshExpires') ?? 604800) * 1000),
    );
    return pair;
  }

  private async createTokenPair(user: Pick<AuthAccount, 'userId' | 'fullName' | 'role'>, storeId?: string): Promise<TokenPair> {
    const accessPayload: AccessPayload = { sub: user.userId, role: user.role, tokenType: 'access', ...(storeId ? { storeId } : {}) };
    const refreshPayload: RefreshPayload = { sub: user.userId, tokenType: 'refresh', jti: randomUUID() };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<number>('jwt.accessExpires') ?? 900,
    });
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: this.config.get<number>('jwt.refreshExpires') ?? 604800,
    });
    return { accessToken, refreshToken, user: { userId: user.userId, fullName: user.fullName, role: user.role } };
  }

  private async verifyRefreshToken(token: string): Promise<RefreshPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(token, { secret: this.config.get<string>('jwt.refreshSecret') });
      if (payload.tokenType !== 'refresh' || !payload.sub) throw new Error('Invalid token type');
      return payload;
    } catch {
      throw this.invalidRefreshToken();
    }
  }

  private invalidRefreshToken(): UnauthorizedException {
    return new UnauthorizedException({ code: ErrorCode.INVALID_REFRESH_TOKEN, message: 'Refresh token không hợp lệ hoặc đã hết hạn' });
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private enforceEmailLimit(email: string, ipAddress: string): void {
    const now = Date.now();
    const keys = [`email:${email}`, `ip:${ipAddress}`];
    const recentByKey = keys.map((key) => ({
      key,
      timestamps: (this.emailRequestTimes.get(key) ?? []).filter((timestamp) => now - timestamp < EMAIL_WINDOW_MS),
    }));
    if (recentByKey.some(({ timestamps }) => timestamps.length >= EMAIL_LIMIT)) {
      throw new HttpException({ code: ErrorCode.TOO_MANY_REQUESTS, message: 'Bạn đã yêu cầu quá nhiều lần, vui lòng thử lại sau' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    recentByKey.forEach(({ key, timestamps }) => this.emailRequestTimes.set(key, [...timestamps, now]));
    if (this.emailRequestTimes.size > 2000) {
      for (const [storedKey, timestamps] of this.emailRequestTimes) {
        if (timestamps.every((timestamp) => now - timestamp >= EMAIL_WINDOW_MS)) this.emailRequestTimes.delete(storedKey);
      }
    }
  }

  private isTransactionUnsupported(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const candidate = error as { code?: number; message?: string };
    return candidate.code === 20 || candidate.message?.includes('Transaction numbers are only allowed') === true;
  }

  private isDuplicateKey(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
  }
}
