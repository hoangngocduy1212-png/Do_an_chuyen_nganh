import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Role } from '../../common/constants/roles';
import { Roles } from '../../common/decorators/roles.decorator';
import { ForecastsService } from './forecasts.service';

export class ForecastQueryDto {
  @IsString({ message: 'Cửa hàng không hợp lệ' }) storeId: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(30) periodDays?: number;
}

@ApiTags('forecasts')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('forecasts')
export class ForecastsController {
  constructor(private readonly forecasts: ForecastsService) {}

  @Get()
  run(@Query() query: ForecastQueryDto) {
    return this.forecasts.run(query.storeId, query.periodDays ?? 7);
  }
}
