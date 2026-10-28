import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { applyIdPlugin } from '../../../common/database/id-plugin';

@Schema({ timestamps: true, versionKey: false })
export class AIFeedback {
  @Prop({ type: String, required: true }) customerId: string;
  @Prop({ type: String, required: true, enum: ['CHATBOT', 'RECOMMENDATION'] }) feedbackType: string;
  @Prop({ type: String }) messageId?: string;
  @Prop({ type: String }) productId?: string;
  @Prop({ type: Boolean, required: true }) isHelpful: boolean;
  @Prop({ type: String, default: '' }) comment: string;
}

export const AIFeedbackSchema = SchemaFactory.createForClass(AIFeedback);
applyIdPlugin(AIFeedbackSchema, 'feedbackId');
