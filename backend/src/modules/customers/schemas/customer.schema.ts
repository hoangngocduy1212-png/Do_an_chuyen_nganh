import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';

@Schema({ timestamps: true, versionKey: false })
export class Customer {
  @Prop({ type: String, required: true, unique: true, default: randomUUID }) customerId: string;
  @Prop({ type: String, required: true, unique: true, index: true }) userId: string;
  @Prop({ type: String, default: '' }) address: string;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);