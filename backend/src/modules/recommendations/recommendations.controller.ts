import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RecommendationsService } from './recommendations.service';

class RecommendationQueryDto {
  @IsOptional() @IsIn(['home', 'product', 'cart']) placement: 'home' | 'product' | 'cart' = 'home';
  @IsString() @IsNotEmpty() storeId: string;
  @IsOptional() @IsString() productId?: string;
}

@ApiTags('recommendations')
@ApiBearerAuth()
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  find(@Query() query: RecommendationQueryDto, @CurrentUser() user?: AuthUser) {
    return this.recommendations.recommend(query.placement, query.storeId, query.productId, user);
  }
}
