import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';
import { applyIdPlugin } from '../../../common/database/id-plugin';

export type CategoryDocument = HydratedDocument<Category>;

// Collection Category (bao cao muc 3.2.3.6)
@Schema({ timestamps: true })
export class Category {
  @Prop({ type: String, required: true, unique: true, sparse: true, default: () => randomUUID() }) categoryId: string;
  @Prop({ required: true, unique: true, trim: true }) categoryName: string;
  @Prop() description?: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
applyIdPlugin(CategorySchema, 'categoryId', (value) => {
  value._id = value.categoryId ?? value._id;
  value.name = value.categoryName;
});
