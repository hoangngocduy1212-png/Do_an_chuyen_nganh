import { Transform, Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductDto {
  @IsString({ message: 'Tên sản phẩm phải là chuỗi' }) productName: string;
  @IsString({ message: 'Mô tả sản phẩm phải là chuỗi' }) description: string;
  @IsString({ message: 'Danh mục sản phẩm không hợp lệ' }) categoryId: string;
  @Type(() => Number) @IsNumber({}, { message: 'Giá sản phẩm phải là số' }) @Min(0, { message: 'Giá sản phẩm không được âm' }) price: number;
  @IsOptional() @Type(() => Number) @IsNumber({}, { message: 'Giá gốc phải là số' }) @Min(0, { message: 'Giá gốc không được âm' }) originalPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber({}, { message: 'Giá khuyến mãi phải là số' }) @Min(0, { message: 'Giá khuyến mãi không được âm' }) salePrice?: number;
  @IsOptional() @Type(() => Date) @IsDate({ message: 'Ngày bắt đầu khuyến mãi không hợp lệ' }) saleStartDate?: Date;
  @IsOptional() @Type(() => Date) @IsDate({ message: 'Ngày kết thúc khuyến mãi không hợp lệ' }) saleEndDate?: Date;
  @IsOptional() @IsString() badge?: string;
  @IsOptional() @IsString() image?: string;
  @IsString({ message: 'Đơn vị sản phẩm phải là chuỗi' }) unit: string;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: string;
}

export class UpdateProductDto {
  @IsOptional() @IsString() productName?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) price?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) originalPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) salePrice?: number;
  @IsOptional() @Type(() => Date) @IsDate() saleStartDate?: Date;
  @IsOptional() @Type(() => Date) @IsDate() saleEndDate?: Date;
  @IsOptional() @IsString() badge?: string;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: string;
}

export class ProductQueryDto {
  @IsOptional() @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi' }) q?: string;
  @IsOptional() @IsString({ message: 'Danh mục không hợp lệ' }) categoryId?: string;
  @IsOptional() @Type(() => Number) @IsNumber({}, { message: 'Giá thấp nhất phải là số' }) @Min(0, { message: 'Giá thấp nhất không được âm' }) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber({}, { message: 'Giá cao nhất phải là số' }) @Min(0, { message: 'Giá cao nhất không được âm' }) maxPrice?: number;
  @IsOptional() @IsString({ message: 'Cửa hàng không hợp lệ' }) storeId?: string;
  @IsOptional() @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value) @IsIn([true, false], { message: 'inStock chỉ nhận true hoặc false' }) inStock?: boolean;
  @IsOptional() @IsIn(['bestseller', 'deals']) collection?: 'bestseller' | 'deals';
  @IsOptional() @IsIn(['price', '-price', '-createdAt', '-sold', '-discount']) sort?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit = 20;
}
