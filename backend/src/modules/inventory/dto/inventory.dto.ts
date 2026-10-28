import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class InventoryQueryDto {
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value) @IsBoolean({ message: 'lowStock chỉ nhận true hoặc false' }) lowStock?: boolean;
}

export class InventoryChangeDto {
  @IsString({ message: 'Cửa hàng không hợp lệ' }) storeId: string;
  @IsString({ message: 'Sản phẩm không hợp lệ' }) productId: string;
  @Type(() => Number) @IsNumber({}, { message: 'Số lượng phải là số' }) @Min(0.001, { message: 'Số lượng phải lớn hơn 0' }) quantity: number;
}
