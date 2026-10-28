import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { applyIdPlugin } from '../../../common/database/id-plugin';

@Schema({ timestamps: true, versionKey: false })
export class MembershipLevel {
  @Prop({ type: String, required: true }) name: string;
  @Prop({ type: Number, required: true, min: 0 }) minPoints: number;
  @Prop({ type: [String], default: [] }) benefits: string[];
  @Prop({ type: Number, required: true, min: 0 }) sortOrder: number;
}

export const MembershipLevelSchema = SchemaFactory.createForClass(MembershipLevel);
MembershipLevelSchema.index({ name: 1 }, { unique: true });
MembershipLevelSchema.index({ minPoints: 1 });
applyIdPlugin(MembershipLevelSchema, 'membershipLevelId');
