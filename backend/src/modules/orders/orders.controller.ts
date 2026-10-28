import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ErrorCode } from '../../common/constants/error-codes';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/constants/roles';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CancelOrderDto,
  CreateOrderDto,
  OrderListQueryDto,
  OrderPreviewDto,
  ReturnOrderDto,
  ShippingInfoDto,
  UpdateOrderStatusDto,
  UpdateWeightDto,
} from './dto/order.dto';
import { OrdersApiService } from './orders-api.service';
import { BadRequestException } from '@nestjs/common';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersApiService) {}

  @Roles(Role.CUSTOMER)
  @Post('preview')
  preview(@CurrentUser() user: AuthUser, @Body() dto: OrderPreviewDto) {
    return this.orders.preview(user, dto);
  }

  @Roles(Role.CUSTOMER)
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Thiếu header Idempotency-Key' });
    }
    return this.orders.create(user, dto, idempotencyKey.trim());
  }

  @Roles(Role.CUSTOMER)
  @Get('my')
  mine(@CurrentUser() user: AuthUser, @Query() query: OrderListQueryDto) {
    return this.orders.mine(user, query);
  }

  @Roles(Role.STAFF, Role.ADMIN)
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: OrderListQueryDto) {
    return this.orders.list(user, query);
  }

  @Roles(Role.CUSTOMER, Role.STAFF, Role.ADMIN)
  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.getOne(user, id);
  }

  @Roles(Role.CUSTOMER)
  @Patch(':id/shipping-info')
  updateShippingInfo(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ShippingInfoDto) {
    return this.orders.updateShippingInfo(user, id, dto);
  }

  @Roles(Role.CUSTOMER)
  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.orders.cancel(user, id, dto);
  }

  @Roles(Role.CUSTOMER)
  @Post(':id/return')
  requestReturn(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReturnOrderDto) {
    return this.orders.requestReturn(user, id, dto);
  }

  @Roles(Role.STAFF, Role.ADMIN)
  @Post(':id/accept')
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.accept(user, id);
  }

  @Roles(Role.STAFF, Role.ADMIN)
  @Patch(':id/items/:itemId/weight')
  updateWeight(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateWeightDto,
  ) {
    return this.orders.updateWeight(user, id, itemId, dto);
  }

  @Roles(Role.STAFF, Role.ADMIN)
  @Patch(':id/status')
  updateStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orders.changeStatus(user, id, dto);
  }
}
