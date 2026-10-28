import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { applyIdPlugin } from '../../../common/database/id-plugin';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, versionKey: false })
export class PointTransaction {
  @Prop({ type: String, required: true }) customerId: string;
  @Prop({ type: String }) orderId?: string;
  @Prop({ type: String, required: true, enum: ['EARN', 'REDEEM', 'ADJUST'] }) type: string;
  @Prop({ type: Number, required: true }) points: number;
  @Prop({ type: Number, required: true, min: 0 }) balanceAfter: number;
  @Prop({ type: String, default: '' }) note: string;
}

export const PointTransactionSchema = SchemaFactory.createForClass(PointTransaction);
PointTransactionSchema.index({ customerId: 1, createdAt: -1 });
applyIdPlugin(PointTransactionSchema, 'transactionId', (value) => {
  value.id = value.transactionId;
  value.description = value.note;
});
