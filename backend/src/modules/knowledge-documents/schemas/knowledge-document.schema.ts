import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { applyIdPlugin } from '../../../common/database/id-plugin';

@Schema({ timestamps: true, versionKey: false })
export class KnowledgeDocument {
  @Prop({ type: String, required: true }) title: string;
  @Prop({ type: String, required: true }) content: string;
  @Prop({ type: String, required: true }) docType: string;
  @Prop({ type: String, required: true, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' }) status: string;
  @Prop({ type: [Number], default: [], select: false }) embedding: number[];
}

export const KnowledgeDocumentSchema = SchemaFactory.createForClass(KnowledgeDocument);
KnowledgeDocumentSchema.index({ status: 1, docType: 1 });
applyIdPlugin(KnowledgeDocumentSchema, 'knowledgeId');
