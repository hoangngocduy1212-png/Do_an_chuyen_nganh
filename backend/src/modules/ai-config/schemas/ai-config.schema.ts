import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import { applyIdPlugin } from '../../../common/database/id-plugin';

@Schema({ timestamps: true, versionKey: false })
export class AIConfig {
  @Prop({ type: String, required: true, enum: ['CHATBOT', 'RECOMMENDATION', 'FORECAST'] }) featureKey: string;
  @Prop({ type: Boolean, default: true }) enabled: boolean;
  @Prop({ type: String, required: true }) modelName: string;
  @Prop({ type: Map, of: MongooseSchema.Types.Mixed, default: {} }) parameters: Map<string, unknown>;
}

export const AIConfigSchema = SchemaFactory.createForClass(AIConfig);
AIConfigSchema.index({ featureKey: 1 }, { unique: true });
applyIdPlugin(AIConfigSchema, 'configId');
