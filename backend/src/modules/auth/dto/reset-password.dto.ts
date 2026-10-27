import { IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString({ message: 'Token không hợp lệ' })
  @MinLength(1, { message: 'Token không hợp lệ' })
  token: string;

  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'Mật khẩu phải có ít nhất một chữ cái và một chữ số' })
  newPassword: string;
}