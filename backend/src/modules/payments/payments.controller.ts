import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { ErrorCode } from '../../common/constants/error-codes';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Role } from '../../common/constants/roles';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreatePaymentDto,
  MockPaymentConfirmDto,
  PaymentWebhookDto,
  RefundPaymentDto,
} from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Roles(Role.CUSTOMER)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    return this.payments.create(user, dto);
  }

  @Roles(Role.CUSTOMER, Role.STAFF, Role.ADMIN)
  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payments.getOne(user, id);
  }

  @Roles(Role.STAFF, Role.ADMIN)
  @Post(':id/refund')
  refund(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RefundPaymentDto) {
    return this.payments.refund(user, id, dto);
  }

  @Public()
  @Post('webhook/:provider')
  webhook(
    @Param('provider') provider: string,
    @Body() dto: PaymentWebhookDto,
    @Headers('x-payment-signature') signature: string | undefined,
    @Req() request: RawBodyRequest<Request>,
  ) {
    if (!request.rawBody) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Không thể xác thực nội dung webhook' });
    }
    return this.payments.handleWebhook(provider, dto, request.rawBody, signature);
  }

  @Roles(Role.ADMIN)
  @Post('mock/:paymentId/confirm')
  mockConfirm(
    @Param('paymentId') paymentId: string,
    @Body() dto: MockPaymentConfirmDto,
  ) {
    return this.payments.mockConfirm(paymentId, dto);
  }
}

@ApiTags('payments')
@ApiBearerAuth()
@Controller('orders')
export class OrderPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Roles(Role.CUSTOMER, Role.STAFF, Role.ADMIN)
  @Get(':id/payments')
  findForOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payments.findForOrder(user, id);
  }
}
