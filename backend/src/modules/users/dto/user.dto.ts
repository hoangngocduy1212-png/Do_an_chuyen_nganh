import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) fullName?: string;
  @IsOptional() @IsString() @MaxLength(20) phoneNumber?: string;
  @IsOptional() @IsString() @MaxLength(500) avatarUrl?: string;
}

export class AddressDto {
  @IsIn(['Nhà', 'Công ty', 'Khác']) label: string;
  @IsString() @IsNotEmpty() recipientName: string;
  @IsString() @IsNotEmpty() phoneNumber: string;
  @IsString() @IsNotEmpty() addressLine: string;
  @IsBoolean() isDefault: boolean;
}

export class ChangePasswordDto {
  @IsString() @IsNotEmpty() currentPassword: string;
  @IsString() @MinLength(8) @MaxLength(72) @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'Mật khẩu phải có ít nhất một chữ cái và một chữ số' }) newPassword: string;
}

export class DeleteAccountDto {
  @IsString() @IsNotEmpty() password: string;
}
