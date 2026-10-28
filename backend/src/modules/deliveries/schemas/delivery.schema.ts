import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { applyIdPlugin } from '../../../common/database/id-plugin';

export type DeliveryStatus = 'WAITING_PICKUP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';

@Schema({ _id: false })
export class DeliveryEvent {
  @Prop({ type: Date, required: true }) time: Date;
  @Prop({ type: String, required: true }) status: string;
  @Prop({ type: String, default: '' }) location: string;
}

export const DeliveryEventSchema = SchemaFactory.createForClass(DeliveryEvent);

@Schema({ timestamps: true, versionKey: false })
export class Delivery {
  @Prop({ type: String, required: true }) orderId: string;
  @Prop({ type: String, required: true }) carrierName: string;
  @Prop({ type: String, required: true }) trackingCode: string;
  @Prop({ type: String, required: true, enum: ['WAITING_PICKUP', 'IN_TRANSIT', 'DELIVERED', 'FAILED'] })
  deliveryStatus: DeliveryStatus;
  @Prop({ type: [DeliveryEventSchema], default: [] }) events: DeliveryEvent[];
  @Prop({ type: Date }) estimatedDeliveryAt?: Date;
  @Prop({ type: Number, min: 0 }) shippingFee?: number;
}

export const DeliverySchema = SchemaFactory.createForClass(Delivery);
DeliverySchema.index({ orderId: 1 }, { unique: true });
applyIdPlugin(DeliverySchema, 'deliveryId');
