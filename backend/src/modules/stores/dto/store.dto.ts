import { PartialType } from '@nestjs/swagger';
import { IsArray, IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class StoreShippingFeeDto {
  @IsOptional() @IsNumber() @Min(0) baseFee?: number;
  @IsOptional() @IsNumber() @Min(0) freeShipThreshold?: number;
}

export class StoreDeliveryZoneDto {
  @IsString() @IsNotEmpty() district: string;
  @IsOptional() @IsArray() @IsString({ each: true }) wards?: string[];
}

export class CreateStoreDto {
  @IsString({ message: 'Tên cửa hàng phải là chuỗi' }) @IsNotEmpty({ message: 'Tên cửa hàng không được để trống' }) storeName: string;
  @IsString({ message: 'Địa chỉ phải là chuỗi' }) @IsNotEmpty({ message: 'Địa chỉ không được để trống' }) address: string;
  @IsString({ message: 'Số điện thoại phải là chuỗi' }) @IsNotEmpty({ message: 'Số điện thoại không được để trống' }) phone: string;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: string;
  @IsOptional() @IsObject() openingHours?: Record<string, { open: string; close: string; closed?: boolean }>;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => StoreDeliveryZoneDto) deliveryZones?: StoreDeliveryZoneDto[];
  @IsOptional() @ValidateNested() @Type(() => StoreShippingFeeDto) shippingFee?: StoreShippingFeeDto;
}

export class UpdateStoreDto extends PartialType(CreateStoreDto) {}
