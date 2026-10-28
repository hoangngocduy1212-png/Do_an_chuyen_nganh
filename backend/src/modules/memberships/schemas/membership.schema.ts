import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { applyIdPlugin } from '../../../common/database/id-plugin';

@Schema({ timestamps: true, versionKey: false })
export class Membership {
  @Prop({ type: String, required: true, unique: true, default: randomUUID }) membershipId: string;
  @Prop({ type: String, required: true }) customerId: string;
  @Prop({ type: String, required: true, unique: true }) memberCode: string;
  @Prop({ type: Number, default: 0, min: 0 }) pointBalance: number;
  @Prop({ type: Number, default: 0, min: 0 }) lifetimePoints: number;
  @Prop({ type: String, default: 'Thường' }) memberLevel: string;
}

export const MembershipSchema = SchemaFactory.createForClass(Membership);
MembershipSchema.index({ customerId: 1 }, { unique: true });
applyIdPlugin(MembershipSchema, 'membershipId');