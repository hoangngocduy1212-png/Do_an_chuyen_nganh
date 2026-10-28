import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { applyIdPlugin } from '../../../common/database/id-plugin';

export type ChatSenderType = 'CUSTOMER' | 'CHATBOT' | 'STAFF';

@Schema({ timestamps: true, versionKey: false })
export class ChatMessage {
  @Prop({ type: String, required: true }) sessionId: string;
  @Prop({ type: String, required: true, enum: ['CUSTOMER', 'CHATBOT', 'STAFF'] }) senderType: ChatSenderType;
  @Prop({ type: String, required: true }) content: string;
  @Prop({ type: [String], default: [] }) productIds: string[];
  @Prop({ type: [String], default: [] }) sources: string[];
  @Prop({ type: Boolean, default: false }) needHandover: boolean;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
ChatMessageSchema.index({ sessionId: 1, createdAt: 1 });
applyIdPlugin(ChatMessageSchema, 'messageId', (value) => {
  const roles: Record<ChatSenderType, string> = { CUSTOMER: 'user', CHATBOT: 'assistant', STAFF: 'staff' };
  const senderType = value.senderType;
  if (typeof senderType === 'string' && senderType in roles) {
    value.role = roles[senderType as ChatSenderType];
  }
});
