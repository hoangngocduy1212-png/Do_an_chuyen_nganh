import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString({ message: 'Tên danh mục phải là chuỗi' }) @MinLength(1, { message: 'Tên danh mục không được để trống' }) categoryName: string;
  @IsOptional() @IsString() description?: string;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
