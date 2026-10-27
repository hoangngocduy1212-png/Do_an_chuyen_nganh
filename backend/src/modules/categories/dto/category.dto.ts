import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString() @MinLength(1) categoryName: string;
  @IsOptional() @IsString() description?: string;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
