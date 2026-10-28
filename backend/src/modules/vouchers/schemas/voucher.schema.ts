import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { applyIdPlugin } from '../../../common/database/id-plugin';

@Schema({ timestamps: true, versionKey: false })
export class Voucher {
  @Prop({ type: String, required: true, unique: true, sparse: true, default: () => randomUUID() }) voucherId: string;
  @Prop({ type: String, required: true, uppercase: true, trim: true }) code: string;
  @Prop({ type: String, required: true }) description: string;
  @Prop({ type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' }) status: string;
  @Prop({ type: Number, required: true, min: 0 }) discountValue: number;
  @Prop({ type: String, enum: ['PERCENT', 'FIXED'], required: true }) discountType: string;
  @Prop({ type: Number, default: 0, min: 0 }) minOrderAmount: number;
  @Prop({ type: Number, min: 0 }) maxDiscountAmount?: number;
  @Prop({ type: Number, min: 0 }) usageLimit?: number;
  @Prop({ type: Number, default: 0, min: 0 }) usedCount: number;
  @Prop({ type: Date, required: true }) startDate: Date;
  @Prop({ type: Date, required: true }) endDate: Date;
}

export const VoucherSchema = SchemaFactory.createForClass(Voucher);
VoucherSchema.index({ code: 1 }, { unique: true });
VoucherSchema.index({ endDate: 1 });
applyIdPlugin(VoucherSchema, 'voucherId');
