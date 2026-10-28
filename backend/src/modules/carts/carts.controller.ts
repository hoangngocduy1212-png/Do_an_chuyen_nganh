import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/constants/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';
import { CartsService } from './carts.service';

@ApiTags('cart')
@ApiBearerAuth()
@Roles(Role.CUSTOMER)
@Controller('cart')
export class CartsController {
  constructor(private readonly carts: CartsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.carts.get(user.userId);
  }

  @Post('items')
  addItem(@CurrentUser() user: AuthUser, @Body() dto: AddCartItemDto) {
    return this.carts.addItem(user.userId, dto);
  }

  @Patch('items/:itemId')
  updateItem(@CurrentUser() user: AuthUser, @Param('itemId') itemId: string, @Body() dto: UpdateCartItemDto) {
    return this.carts.updateItem(user.userId, itemId, dto.quantity);
  }

  @Delete('items/:itemId')
  removeItem(@CurrentUser() user: AuthUser, @Param('itemId') itemId: string) {
    return this.carts.removeItem(user.userId, itemId);
  }

  @Delete()
  clear(@CurrentUser() user: AuthUser) {
    return this.carts.clear(user.userId);
  }

  @Post('validate')
  validate(@CurrentUser() user: AuthUser) {
    return this.carts.validate(user.userId);
  }
}
