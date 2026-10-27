import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email không hợp lệ' }) email: string;
  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu' }) password: string;
}
