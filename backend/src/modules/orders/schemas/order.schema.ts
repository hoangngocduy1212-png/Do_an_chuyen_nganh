import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model, Query, UpdateQuery } from 'mongoose';
import { applyIdPlugin } from '../../../common/database/id-plugin';
import { Counter, nextOrderCode } from '../../counters/schemas/counter.schema';

export type ReceiveMethod = 'DELIVERY' | 'PICKUP';
export type OrderStatus = 'PENDING' | 'PREPARING' | 'READY_FOR_PICKUP' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED' | 'RETURNING' | 'RETURNED';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
const ORDER_STATUSES: readonly OrderStatus[] = [
  'PENDING', 'PREPARING', 'READY_FOR_PICKUP', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'RETURNING', 'RETURNED',
];

@Schema({ _id: false })
export class OrderStatusEntry {
  @Prop({ type: String, required: true }) status: OrderStatus;
  @Prop({ type: Date, required: true, default: Date.now }) at: Date;
  @Prop({ type: String, required: true, default: 'SYSTEM' }) by: string;
}

export const OrderStatusEntrySchema = SchemaFactory.createForClass(OrderStatusEntry);

@Schema({ timestamps: true, versionKey: false })
export class Order {
  @Prop({ type: String, required: true }) orderCode: string;
  @Prop({ type: String, required: true }) customerId: string;
  @Prop({ type: String, required: true }) storeId: string;
  @Prop({ type: String, required: true, enum: ['DELIVERY', 'PICKUP'] }) receiveMethod: ReceiveMethod;
  @Prop({ type: String, required: true, enum: ['PENDING', 'PREPARING', 'READY_FOR_PICKUP', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'RETURNING', 'RETURNED'], default: 'PENDING' })
  orderStatus: OrderStatus;
  @Prop({ type: String }) shippingAddress?: string;
  @Prop({ type: String, required: true }) recipientName: string;
  @Prop({ type: String, required: true }) recipientPhone: string;
  @Prop({ type: Date }) pickupTime?: Date;
  @Prop({ type: String }) note?: string;
  @Prop({ type: Number, required: true, min: 0 }) subtotal: number;
  @Prop({ type: Number, default: 0, min: 0 }) discountAmount: number;
  @Prop({ type: Number, default: 0, min: 0 }) initialDiscountAmount: number;
  @Prop({ type: Number, default: 0, min: 0 }) shippingFee: number;
  @Prop({ type: Number, required: true, min: 0 }) totalAmount: number;
  @Prop({ type: Number, default: 0 }) paidAmount: number;
  @Prop({ type: Number, default: 0 }) amountDue: number;
  @Prop({ type: String }) voucherCode?: string;
  @Prop({ type: String, enum: ['CASH', 'CARD', 'TRANSFER'] }) paymentMethod?: PaymentMethod;
  @Prop({ type: String, enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'], default: 'PENDING' }) paymentStatus: PaymentStatus;
  @Prop({ type: String }) idempotencyKey?: string;
  @Prop({ type: Date }) reservationExpiresAt?: Date;
  @Prop({ type: String }) cancelReason?: string;
  @Prop({ type: String }) returnReason?: string;
  @Prop({ type: String }) returnDescription?: string;
  @Prop({ type: Date }) estimatedDeliveryAt?: Date;
  @Prop({ type: [OrderStatusEntrySchema], default: [] }) statusHistory: OrderStatusEntry[];
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ orderCode: 1 }, { unique: true });
OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ storeId: 1, orderStatus: 1, createdAt: -1 });
OrderSchema.index({ customerId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
OrderSchema.index({ reservationExpiresAt: 1 }, { partialFilterExpression: { reservationExpiresAt: { $type: 'date' } } });
OrderSchema.pre('save', function () {
  if (this.isNew || this.isModified('orderStatus')) {
    this.statusHistory.push({ status: this.orderStatus, at: new Date(), by: 'SYSTEM' });
  }
});

function appendStatusHistory(this: Query<unknown, Order>): void {
  const status = this.get('orderStatus');
  if (typeof status !== 'string' || !ORDER_STATUSES.includes(status as OrderStatus)) return;
  const update = this.getUpdate();
  if (!update || Array.isArray(update)) return;

  const updateDocument = update as UpdateQuery<Order>;
  const push = updateDocument.$push;
  this.setUpdate({
    ...updateDocument,
    $push: {
      ...(push && typeof push === 'object' ? push : {}),
      statusHistory: { status: status as OrderStatus, at: new Date(), by: 'SYSTEM' },
    },
  });
}

OrderSchema.pre('findOneAndUpdate', appendStatusHistory);
OrderSchema.pre('updateOne', appendStatusHistory);
OrderSchema.pre('updateMany', appendStatusHistory);
applyIdPlugin(OrderSchema, 'orderId');

export async function createOrderWithCode(
  orderModel: Model<Order>,
  counterModel: Model<Counter>,
  data: Omit<Order, 'orderCode'>,
): Promise<HydratedDocument<Order>> {
  const orderCode = await nextOrderCode(counterModel);
  return orderModel.create({ ...data, orderCode });
}
