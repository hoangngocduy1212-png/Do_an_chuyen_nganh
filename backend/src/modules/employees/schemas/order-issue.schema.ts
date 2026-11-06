import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { applyIdPlugin } from '../../../common/database/id-plugin';

// Lưu vấn đề phát sinh khi nhân viên chuẩn bị đơn, không tự ý sửa hoặc hủy đơn.
@Schema({ timestamps: true, versionKey: false })
export class OrderIssue {
  @Prop({ type: String, required: true }) orderId: string;
  @Prop({ type: String, required: true }) storeId: string;
  @Prop({ type: String, required: true, enum: ['OUT_OF_STOCK', 'INVALID_INFORMATION', 'OTHER'] }) type: string;
  @Prop({ type: String, required: true }) detail: string;
  @Prop({ type: String, required: true, enum: ['OPEN', 'RESOLVED'], default: 'OPEN' }) status: string;
  @Prop({ type: String, required: true }) createdBy: string;
  @Prop({ type: String }) resolvedBy?: string;
  @Prop({ type: Date }) resolvedAt?: Date;
}

export const OrderIssueSchema = SchemaFactory.createForClass(OrderIssue);
OrderIssueSchema.index({ storeId: 1, status: 1, createdAt: -1 });
applyIdPlugin(OrderIssueSchema, 'issueId');
