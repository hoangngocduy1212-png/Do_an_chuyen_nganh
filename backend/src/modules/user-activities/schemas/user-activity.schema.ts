import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { applyIdPlugin } from '../../../common/database/id-plugin';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, versionKey: false })
export class UserActivity {
  @Prop({ type: String }) customerId?: string;
  @Prop({ type: String }) anonymousId?: string;
  @Prop({ type: String }) productId?: string;
  @Prop({ type: String, required: true, enum: ['VIEW', 'ADD_TO_CART', 'SEARCH'] }) activityType: string;
  @Prop({ type: String }) searchQuery?: string;
}

export const UserActivitySchema = SchemaFactory.createForClass(UserActivity);
UserActivitySchema.index({ customerId: 1, createdAt: -1 });
UserActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });
applyIdPlugin(UserActivitySchema, 'activityId');
