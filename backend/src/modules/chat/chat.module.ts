import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiClientModule } from '../ai-client/ai-client.module';
import { ChatMessage, ChatMessageSchema } from '../chat-messages/schemas/chat-message.schema';
import { ChatSession, ChatSessionSchema } from '../chat-sessions/schemas/chat-session.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { Employee, EmployeeSchema } from '../employees/schemas/employee.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [
    AiClientModule,
    RecommendationsModule,
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Employee.name, schema: EmployeeSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
