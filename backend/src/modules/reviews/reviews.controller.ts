import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/constants/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateReviewDto, MyReviewsQueryDto, ProductReviewsQueryDto } from './dto/review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@ApiBearerAuth()
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get('products/:productId/reviews')
  forProduct(@Param('productId') productId: string, @Query() query: ProductReviewsQueryDto) {
    return this.reviews.forProduct(productId, query.page, query.limit);
  }

  @Roles(Role.CUSTOMER)
  @Get('reviews/my')
  mine(@CurrentUser() user: AuthUser, @Query() query: MyReviewsQueryDto) {
    return this.reviews.mine(user.userId, query.status);
  }

  @Roles(Role.CUSTOMER)
  @Post('reviews')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReviewDto) {
    return this.reviews.create(user.userId, dto);
  }
}
