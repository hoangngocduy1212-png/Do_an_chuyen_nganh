import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export const PICKUP_TIME_PATTERN = /^(\d{2}:\d{2}\s*[–-]\s*\d{2}:\d{2}|\d{4}-\d{2}-\d{2}T.+)$/;

export class OrderPreviewDto {
  @IsString({ message: 'Cửa hàng không hợp lệ' }) storeId: string;
  @IsIn(['DELIVERY', 'PICKUP'], { message: 'Hình thức nhận hàng không hợp lệ' }) receiveMethod: 'DELIVERY' | 'PICKUP';
  @IsOptional() @IsString({ message: 'Địa chỉ giao hàng phải là chuỗi' }) shippingAddress?: string;
  @IsOptional() @IsString({ message: 'Mã voucher không hợp lệ' }) voucherCode?: string;
}

export class CreateOrderDto extends OrderPreviewDto {
  @IsOptional() @IsString() recipientName?: string;
  @IsOptional() @IsString() recipientPhone?: string;
  @IsOptional() @Matches(PICKUP_TIME_PATTERN, { message: 'Thời gian nhận hàng không hợp lệ' }) pickupTime?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() pickupNote?: string;
  @IsOptional() @IsIn(['CASH', 'TRANSFER', 'CARD'], { message: 'Phương thức thanh toán không hợp lệ' }) paymentMethod?: 'CASH' | 'TRANSFER' | 'CARD';
}

export class CancelOrderDto {
  @IsString({ message: 'Lý do hủy đơn không hợp lệ' }) reason: string;
}

export class ReturnOrderDto {
  @IsString({ message: 'Lý do trả hàng không hợp lệ' }) reason: string;
  @IsString({ message: 'Mô tả trả hàng không hợp lệ' }) description: string;
}

export class ShippingInfoDto {
  @IsOptional() @IsString() shippingAddress?: string;
  @IsOptional() @IsString() recipientName?: string;
  @IsOptional() @IsString() recipientPhone?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @Matches(PICKUP_TIME_PATTERN, { message: 'Thời gian nhận hàng không hợp lệ' }) pickupTime?: string;
  @IsOptional() @IsString() pickupNote?: string;
}

export class OrderListQueryDto {
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsIn(['PENDING', 'PREPARING', 'SHIPPING', 'READY_FOR_PICKUP', 'DELIVERED', 'CANCELLED', 'RETURNING', 'RETURNED']) orderStatus?: string;
  @IsOptional() @IsIn(['DELIVERY', 'PICKUP']) receiveMethod?: 'DELIVERY' | 'PICKUP';
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) limit = 20;
}

export class UpdateWeightDto {
  @Type(() => Number) @IsNumber({}, { message: 'Khối lượng thực tế phải là số' }) @Min(0.001, { message: 'Khối lượng thực tế phải lớn hơn 0' }) actualWeight: number;
}

export class UpdateOrderStatusDto {
  @IsIn(['PREPARING', 'SHIPPING', 'READY_FOR_PICKUP', 'DELIVERED', 'RETURNED'], { message: 'Trạng thái đơn hàng không hợp lệ' }) orderStatus: string;
}
