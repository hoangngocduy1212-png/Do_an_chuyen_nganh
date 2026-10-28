import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { applyIdPlugin } from '../../../common/database/id-plugin';

@Schema({ timestamps: true, versionKey: false })
export class Product {
  @Prop({ type: String, required: true, unique: true, sparse: true, default: () => randomUUID() }) productId: string;
  @Prop({ type: String, required: true, trim: true }) productName: string;
  @Prop({ type: String, required: true }) description: string;
  @Prop({ type: String, required: true, ref: 'Category' }) categoryId: string;
  @Prop({ type: Number, required: true, min: 0 }) price: number;
  @Prop({ type: Number, min: 0 }) originalPrice?: number;
  @Prop({ type: Number, min: 0 }) salePrice?: number;
  @Prop({ type: Date }) saleStartDate?: Date;
  @Prop({ type: Date, index: true }) saleEndDate?: Date;
  @Prop({ type: String }) badge?: string;
  @Prop({ type: String, default: '' }) image: string;
  @Prop({ type: String, required: true }) unit: string;
  @Prop({ type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' }) status: string;
  @Prop({ type: Number, default: 0, min: 0 }) avgRating: number;
  @Prop({ type: Number, default: 0, min: 0 }) reviewCount: number;
  @Prop({ type: Number, default: 0, min: 0 }) soldCount: number;
  @Prop({ type: String, default: '', select: false }) searchText: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
ProductSchema.index({ status: 1, categoryId: 1, price: 1 });
ProductSchema.index({ searchText: 'text' });
ProductSchema.pre('save', function () {
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
  this.searchText = normalize(`${this.productName} ${this.description}`);
});
applyIdPlugin(ProductSchema, 'productId', (value) => {
  value._id = value.productId ?? value._id;
  value.name = value.productName;
  value.imageUrl = value.image;
});
