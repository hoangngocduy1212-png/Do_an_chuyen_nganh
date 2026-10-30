import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Role } from '../../common/constants/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { UserActivitiesService } from './user-activities.service';

export class RecordActivityDto {
  @IsIn(['VIEW', 'ADD_TO_CART', 'SEARCH']) activityType: 'VIEW' | 'ADD_TO_CART' | 'SEARCH';
  @IsOptional() @IsString() @IsNotEmpty() productId?: string;
  @IsOptional() @IsString() @MaxLength(200) searchQuery?: string;
  @IsOptional() @IsString() @MaxLength(100) anonymousId?: string;
}

@ApiTags('activities')
@ApiBearerAuth()
@Controller('activities')
export class UserActivitiesController {
  constructor(private readonly activities: UserActivitiesService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  async record(@Body() dto: RecordActivityDto, @CurrentUser() user?: AuthUser) {
    await this.activities.record(dto, user?.role === Role.CUSTOMER ? user.userId : undefined);
    return { recorded: true };
  }
}
