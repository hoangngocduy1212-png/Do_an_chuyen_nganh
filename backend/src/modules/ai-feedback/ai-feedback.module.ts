import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { AiFeedbackController, AiFeedbackService } from './ai-feedback.controller';
import { AIFeedback, AIFeedbackSchema } from './schemas/ai-feedback.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: AIFeedback.name, schema: AIFeedbackSchema },
    { name: Customer.name, schema: CustomerSchema },
  ])],
  controllers: [AiFeedbackController],
  providers: [AiFeedbackService],
})
export class AiFeedbackModule {}
