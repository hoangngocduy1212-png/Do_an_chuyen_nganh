import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';

@Schema({ timestamps: true, versionKey: false })
export class Cart {
  @Prop({ type: String, required: true, unique: true, default: randomUUID }) cartId: string;
  @Prop({ type: String, required: true, unique: true, index: true }) customerId: string;
  @Prop({ type: Number, default: 0, min: 0 }) totalAmount: number;
}

export const CartSchema = SchemaFactory.createForClass(Cart);