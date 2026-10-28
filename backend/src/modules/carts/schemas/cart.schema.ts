import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { applyIdPlugin } from '../../../common/database/id-plugin';

@Schema({ timestamps: true, versionKey: false })
export class Cart {
  @Prop({ type: String, required: true, unique: true, default: () => randomUUID() }) cartId: string;
  @Prop({ type: String, required: true }) customerId: string;
  @Prop({ type: String }) storeId?: string;
  @Prop({ type: Number, default: 0, min: 0 }) totalAmount: number;
}

export const CartSchema = SchemaFactory.createForClass(Cart);
CartSchema.index({ customerId: 1 }, { unique: true });
applyIdPlugin(CartSchema, 'cartId');