import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Employee, EmployeeSchema } from './schemas/employee.schema';
import { Store, StoreSchema } from '../stores/schemas/store.schema';
import { UsersModule } from '../users/users.module';
import { OrdersModule } from '../orders/orders.module';
import { InventoryModule } from '../inventory/inventory.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { EmployeeOperationsService } from './employee-operations.service';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { ChatSession, ChatSessionSchema } from '../chat-sessions/schemas/chat-session.schema';
import { ChatMessage, ChatMessageSchema } from '../chat-messages/schemas/chat-message.schema';
import { VouchersModule } from '../vouchers/vouchers.module';
import { OrderIssue, OrderIssueSchema } from './schemas/order-issue.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { EmployeeAccountsService } from './employee-accounts.service';
import { AdminEmployeesController } from './admin-employees.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Employee.name, schema: EmployeeSchema },
      { name: Store.name, schema: StoreSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Order.name, schema: OrderSchema },
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: OrderIssue.name, schema: OrderIssueSchema },
      { name: User.name, schema: UserSchema },
    ]),
    UsersModule,
    OrdersModule,
    InventoryModule,
    VouchersModule,
  ],
  controllers: [EmployeesController, AdminEmployeesController],
  providers: [EmployeesService, EmployeeOperationsService, EmployeeAccountsService],
  exports: [MongooseModule],
})
export class EmployeesModule {}
