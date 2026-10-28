import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { applyIdPlugin } from '../../../common/database/id-plugin';

@Schema({ timestamps: true, versionKey: false })
export class Review {
  @Prop({ type: String, required: true }) customerId: string;
  @Prop({ type: String, required: true }) orderId: string;
  @Prop({ type: String, required: true }) productId: string;
  @Prop({ type: Number, required: true, min: 1, max: 5 }) rating: number;
  @Prop({ type: String, default: '' }) comment: string;
  @Prop({ type: Boolean, default: false }) isHidden: boolean;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);
ReviewSchema.index({ orderId: 1, productId: 1 }, { unique: true });
ReviewSchema.index({ productId: 1, createdAt: -1 });
applyIdPlugin(ReviewSchema, 'reviewId');
