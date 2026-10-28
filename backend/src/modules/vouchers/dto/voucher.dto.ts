import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateVoucherDto {
  @IsString({ message: 'Mã voucher không hợp lệ' }) code: string;
  @IsString({ message: 'Mô tả voucher không hợp lệ' }) description: string;
  @Type(() => Number) @IsNumber({}, { message: 'Giá trị giảm phải là số' }) @Min(0, { message: 'Giá trị giảm không được âm' }) discountValue: number;
  @Type(() => Date) @IsDate({ message: 'Ngày bắt đầu không hợp lệ' }) startDate: Date;
  @Type(() => Date) @IsDate({ message: 'Ngày kết thúc không hợp lệ' }) endDate: Date;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minOrderAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) usageLimit?: number;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: string;
}

export class UpdateVoucherDto extends PartialType(CreateVoucherDto) {}

export class ValidateVoucherDto {
  @IsString({ message: 'Mã voucher không hợp lệ' }) code: string;
  @Type(() => Number) @IsNumber({}, { message: 'Giá trị đơn hàng phải là số' }) @Min(0, { message: 'Giá trị đơn hàng không được âm' }) orderAmount: number;
}

export class AvailableVoucherQueryDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) orderAmount?: number;
}
