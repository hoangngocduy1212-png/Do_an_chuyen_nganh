import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { applyIdPlugin } from '../../../common/database/id-plugin';

@Schema({ timestamps: true, versionKey: false })
export class CartItem {
  @Prop({ type: String, required: true, unique: true, sparse: true, default: () => randomUUID() }) itemId: string;
  @Prop({ type: String, required: true }) cartId: string;
  @Prop({ type: String, required: true }) productId: string;
  @Prop({ type: Number, required: true, min: 0.001 }) quantity: number;
  @Prop({ type: Number, required: true, min: 0 }) price: number;
}

export const CartItemSchema = SchemaFactory.createForClass(CartItem);
CartItemSchema.index({ cartId: 1, productId: 1 }, { unique: true });
applyIdPlugin(CartItemSchema, 'itemId', (value) => {
  value.priceAtAdd = value.price;
});
