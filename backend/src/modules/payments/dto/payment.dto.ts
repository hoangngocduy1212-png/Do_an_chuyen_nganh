import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsString({ message: 'Mã đơn hàng không hợp lệ' }) orderId: string;
  @IsIn(['TRANSFER', 'CARD', 'CASH'], { message: 'Phương thức thanh toán không hợp lệ' })
  paymentMethod: 'TRANSFER' | 'CARD' | 'CASH';
}

export class PaymentWebhookDto {
  @IsString({ message: 'Mã thanh toán không hợp lệ' }) paymentId: string;
  @IsString({ message: 'Mã giao dịch không hợp lệ' }) transactionCode: string;
  @Type(() => Number) @IsInt({ message: 'Số tiền thanh toán phải là số nguyên' }) @Min(0)
  amount: number;
  @IsIn(['SUCCESS', 'FAILED'], { message: 'Trạng thái giao dịch không hợp lệ' })
  status: 'SUCCESS' | 'FAILED';
}

export class MockPaymentConfirmDto {
  @IsIn(['SUCCESS', 'FAILED'], { message: 'Trạng thái giao dịch không hợp lệ' })
  status: 'SUCCESS' | 'FAILED';
  @IsOptional() @IsString({ message: 'Mã giao dịch không hợp lệ' }) transactionCode?: string;
}

export class RefundPaymentDto {
  @IsOptional() @Type(() => Number) @IsInt({ message: 'Số tiền hoàn phải là số nguyên' }) @Min(1)
  amount?: number;
  @IsString({ message: 'Lý do hoàn tiền không hợp lệ' }) @IsNotEmpty({ message: 'Lý do hoàn tiền không được để trống' }) reason: string;
}
