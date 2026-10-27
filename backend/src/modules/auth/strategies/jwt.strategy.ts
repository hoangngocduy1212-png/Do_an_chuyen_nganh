import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '../../../common/constants/roles.enum';
import { AuthUser } from '../../../common/decorators/current-user.decorator';

interface AccessTokenPayload {
  sub: string;
  role: Role;
  storeId?: string;
  tokenType: 'access';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret')!,
    });
  }

  validate(payload: AccessTokenPayload): AuthUser {
    if (payload.tokenType !== 'access' || !payload.sub || !Object.values(Role).includes(payload.role)) {
      throw new UnauthorizedException('Access token không hợp lệ');
    }
    return { userId: payload.sub, role: payload.role, storeId: payload.storeId };
  }
}
