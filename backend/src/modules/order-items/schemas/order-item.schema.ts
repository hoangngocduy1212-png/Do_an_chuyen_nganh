import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { applyIdPlugin } from '../../../common/database/id-plugin';

@Schema({ timestamps: true, versionKey: false })
export class OrderItem {
  @Prop({ type: String, required: true }) orderId: string;
  @Prop({ type: String, required: true }) productId: string;
  @Prop({ type: String, required: true }) productName: string;
  @Prop({ type: String, default: '' }) image: string;
  @Prop({ type: String, required: true }) unit: string;
  @Prop({ type: Number, required: true, min: 0 }) unitPrice: number;
  @Prop({ type: Number, required: true, min: 0 }) quantity: number;
  @Prop({ type: Number, min: 0 }) actualWeight?: number;
  @Prop({ type: Number, required: true, min: 0 }) lineTotal: number;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);
OrderItemSchema.index({ orderId: 1 });
OrderItemSchema.index({ productId: 1 });
applyIdPlugin(OrderItemSchema, 'orderItemId');
