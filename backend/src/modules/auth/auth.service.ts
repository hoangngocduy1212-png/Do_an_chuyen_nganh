import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Role, UserStatus } from '../../common/constants/roles';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private users: UsersService, private jwt: JwtService) {}

  async register(dto: RegisterDto) {
    if (await this.users.findByEmailWithPassword(dto.email)) {
      throw new ConflictException('Email da ton tai');
    }
    const password = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create({ ...dto, password, role: Role.CUSTOMER });
    // TODO (module customers/carts/memberships): tao them Customer + Cart + Membership cho user nay
    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmailWithPassword(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Email hoac mat khau khong dung');
    }
    if (user.status === UserStatus.LOCKED) {
      throw new UnauthorizedException('Tai khoan da bi khoa');
    }
    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: any) {
    const accessToken = this.jwt.sign({ sub: String(user._id), role: user.role });
    return {
      accessToken,
      // TODO: them refreshToken (POST /auth/refresh) theo API.md
      user: { userId: String(user._id), fullName: user.fullName, email: user.email, role: user.role },
    };
  }
}
