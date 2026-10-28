import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { applyIdPlugin } from '../../../common/database/id-plugin';

@Schema({ timestamps: true, versionKey: false })
export class ChatSession {
  @Prop({ type: String }) customerId?: string;
  @Prop({ type: String }) guestToken?: string;
  @Prop({ type: String, enum: ['AI_CHATTING', 'HANDED_OVER', 'CLOSED'], default: 'AI_CHATTING' }) status: string;
  @Prop({ type: String }) employeeId?: string;
  @Prop({ type: String }) storeId?: string;
  @Prop({ type: Date, default: Date.now }) startedAt: Date;
  @Prop({ type: Date }) lastMessageAt?: Date;
  @Prop({ type: Date }) handoverRequestedAt?: Date;
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);
ChatSessionSchema.index({ status: 1, lastMessageAt: -1 });
ChatSessionSchema.index({ customerId: 1, startedAt: -1 });
applyIdPlugin(ChatSessionSchema, 'sessionId');
