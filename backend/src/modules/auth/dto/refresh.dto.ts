import { IsJWT } from 'class-validator';

export class RefreshDto {
  @IsJWT({ message: 'Refresh token không hợp lệ' }) refreshToken: string;
}