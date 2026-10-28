import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { applyIdPlugin } from '../../../common/database/id-plugin';

@Schema({ timestamps: true, versionKey: false })
export class DemandForecast {
  @Prop({ type: String, required: true }) storeId: string;
  @Prop({ type: String, required: true }) productId: string;
  @Prop({ type: Date, required: true }) periodStart: Date;
  @Prop({ type: Number, required: true, min: 0 }) predictedQuantity: number;
  @Prop({ type: String, required: true, enum: ['SHORTAGE', 'OVERSTOCK', 'NORMAL'] }) alertType: string;
  @Prop({ type: String, required: true, enum: ['PENDING', 'ACCEPTED', 'ADJUSTED'], default: 'PENDING' }) decisionStatus: string;
  @Prop({ type: Number, min: 0 }) approvedQuantity?: number;
}

export const DemandForecastSchema = SchemaFactory.createForClass(DemandForecast);
DemandForecastSchema.index({ storeId: 1, productId: 1, periodStart: 1 }, { unique: true });
applyIdPlugin(DemandForecastSchema, 'forecastId');
