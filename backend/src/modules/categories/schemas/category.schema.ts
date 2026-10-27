import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

// Collection Category (bao cao muc 3.2.3.6)
@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true, unique: true, trim: true }) categoryName: string;
  @Prop() description?: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
