import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { applyIdPlugin } from '../../../common/database/id-plugin';
import { PaymentMethod, PaymentStatus } from '../../orders/schemas/order.schema';

@Schema({ timestamps: true, versionKey: false })
export class Payment {
  @Prop({ type: String, required: true }) orderId: string;
  @Prop({ type: String, required: true, enum: ['CASH', 'CARD', 'TRANSFER'] }) paymentMethod: PaymentMethod;
  @Prop({ type: String, enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'], default: 'PENDING' }) paymentStatus: PaymentStatus;
  @Prop({ type: String }) provider?: string;
  @Prop({ type: String }) transactionCode?: string;
  @Prop({ type: Number, required: true, min: 0 }) amount: number;
  @Prop({ type: String }) note?: string;
  @Prop({ type: String }) transferContent?: string;
  @Prop({ type: String }) relatedPaymentId?: string;
  @Prop({ type: Date }) expiresAt?: Date;
  @Prop({ type: Date }) paidAt?: Date;
  @Prop({ type: Date }) webhookReceivedAt?: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ transactionCode: 1 }, { unique: true, sparse: true });
applyIdPlugin(PaymentSchema, 'paymentId');
