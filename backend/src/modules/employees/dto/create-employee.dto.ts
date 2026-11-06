import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateEmployeeDto {
  @IsString() @MinLength(2) @MaxLength(100) @Matches(/\S/, { message: 'Vui lòng nhập họ tên' })
  fullName: string;

  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @Matches(/^0\d{9}$/, { message: 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0' })
  phone: string;

  @IsString() @MinLength(8) @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'Mật khẩu cần ít nhất một chữ cái và một chữ số' })
  password: string;

  @IsString() @Matches(/^[A-Za-z0-9_-]{2,30}$/, { message: 'Mã nhân viên gồm 2–30 chữ, số, dấu gạch ngang hoặc gạch dưới' })
  employeeCode: string;

  @IsString() @MinLength(2) @MaxLength(100) @Matches(/\S/)
  employeeRole: string;

  @IsString() @MinLength(1) @MaxLength(100) @Matches(/\S/)
  storeId: string;
}
