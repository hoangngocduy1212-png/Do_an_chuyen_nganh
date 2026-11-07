import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class EmployeeListQueryDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}

export class ReviewVisibilityDto {
  @IsBoolean() isHidden: boolean;
}

export class StaffMessageDto {
  @IsString() @IsNotEmpty() @Matches(/\S/) @MaxLength(2000) content: string;
}

export class CreateOrderIssueDto {
  @IsIn(['OUT_OF_STOCK', 'INVALID_INFORMATION', 'OTHER']) type: string;
  @IsString() @IsNotEmpty() @Matches(/\S/) @MaxLength(2000) detail: string;
}
