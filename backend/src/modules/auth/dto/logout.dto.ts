import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @IsOptional()
  @IsString({ message: 'Refresh token không hợp lệ' })
  refreshToken?: string;
}