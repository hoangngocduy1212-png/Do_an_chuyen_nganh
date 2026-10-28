import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { applyIdPlugin } from '../../../common/database/id-plugin';

@Schema({ _id: false })
export class StoreShippingFee {
  @Prop({ type: Number, required: true, min: 0 }) baseFee: number;
  @Prop({ type: Number, min: 0 }) freeShipThreshold?: number;
}

export const StoreShippingFeeSchema = SchemaFactory.createForClass(StoreShippingFee);

@Schema({ _id: false })
export class StoreDeliveryZone {
  @Prop({ type: String, required: true }) district: string;
  @Prop({ type: [String], default: [] }) wards: string[];
}

export const StoreDeliveryZoneSchema = SchemaFactory.createForClass(StoreDeliveryZone);

@Schema({ _id: false })
export class StoreOpeningHours {
  @Prop({ type: String, required: true }) open: string;
  @Prop({ type: String, required: true }) close: string;
  @Prop({ type: Boolean, default: false }) closed: boolean;
}

export const StoreOpeningHoursSchema = SchemaFactory.createForClass(StoreOpeningHours);

@Schema({ timestamps: true, versionKey: false })
export class Store {
  @Prop({ type: String, required: true, unique: true, sparse: true, default: () => randomUUID() }) storeId: string;
  @Prop({ type: String, required: true, trim: true }) storeName: string;
  @Prop({ type: String, required: true }) address: string;
  @Prop({ type: String, required: true }) phone: string;
  @Prop({ type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true }) status: string;
  @Prop({ type: Map, of: StoreOpeningHoursSchema, default: {} }) openingHours: Map<string, StoreOpeningHours>;
  @Prop({ type: [StoreDeliveryZoneSchema], default: [] }) deliveryZones: StoreDeliveryZone[];
  @Prop({ type: StoreShippingFeeSchema, required: true }) shippingFee: StoreShippingFee;
}

export const StoreSchema = SchemaFactory.createForClass(Store);
applyIdPlugin(StoreSchema, 'storeId', (value) => {
  value._id = value.storeId ?? value._id;
  value.name = value.storeName;
  value.phoneNumber = value.phone;
});
