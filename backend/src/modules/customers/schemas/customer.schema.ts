import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { applyIdPlugin } from '../../../common/database/id-plugin';

@Schema({ _id: false })
export class CustomerAddress {
  @Prop({ type: String, required: true }) addressId: string;
  @Prop({ type: String, required: true }) label: string;
  @Prop({ type: String, required: true }) recipientName: string;
  @Prop({ type: String, required: true }) phone: string;
  @Prop({ type: String, required: true }) addressLine: string;
  @Prop({ type: Boolean, default: false }) isDefault: boolean;
}

export const CustomerAddressSchema = SchemaFactory.createForClass(CustomerAddress);

@Schema({ timestamps: true, versionKey: false })
export class Customer {
  @Prop({ type: String, required: true, unique: true, default: randomUUID }) customerId: string;
  @Prop({ type: String, required: true }) userId: string;
  @Prop({ type: String, default: '' }) address: string;
  @Prop({ type: [CustomerAddressSchema], default: [], validate: (addresses: CustomerAddress[]) => addresses.length <= 5 })
  addresses: CustomerAddress[];
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
CustomerSchema.index({ userId: 1 }, { unique: true });
applyIdPlugin(CustomerSchema, 'customerId');