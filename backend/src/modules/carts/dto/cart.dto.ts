import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddCartItemDto {
  @IsString({ message: 'Sản phẩm không hợp lệ' }) productId: string;
  @Type(() => Number) @IsNumber({}, { message: 'Số lượng phải là số' }) @Min(0.001, { message: 'Số lượng phải lớn hơn 0' }) quantity: number;
  @IsOptional() @IsString({ message: 'Cửa hàng không hợp lệ' }) storeId?: string;
}

export class UpdateCartItemDto {
  @Type(() => Number) @IsNumber({}, { message: 'Số lượng phải là số' }) @Min(0.001, { message: 'Số lượng phải lớn hơn 0' }) quantity: number;
}
