import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Counter, CounterSchema } from '../counters/schemas/counter.schema';
import { InventoryModule } from '../inventory/inventory.module';
import { OrderItem, OrderItemSchema } from '../order-items/schemas/order-item.schema';
import { OrderReservationExpiryService } from './order-reservation-expiry.service';
import { Order, OrderSchema } from './schemas/order.schema';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersApiService } from './orders-api.service';
import { VouchersModule } from '../vouchers/vouchers.module';
import { Cart, CartSchema } from '../carts/schemas/cart.schema';
import { CartItem, CartItemSchema } from '../cart-items/schemas/cart-item.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Store, StoreSchema } from '../stores/schemas/store.schema';
import { Voucher, VoucherSchema } from '../vouchers/schemas/voucher.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { Membership, MembershipSchema } from '../memberships/schemas/membership.schema';
import { MembershipLevel, MembershipLevelSchema } from '../membership-levels/schemas/membership-level.schema';
import { PointTransaction, PointTransactionSchema } from '../point-transactions/schemas/point-transaction.schema';
import { Employee, EmployeeSchema } from '../employees/schemas/employee.schema';
import { Delivery, DeliverySchema } from '../deliveries/schemas/delivery.schema';
import { Inventory, InventorySchema } from '../inventory/schemas/inventory.schema';

@Module({
  imports: [
    InventoryModule,
    VouchersModule,
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: OrderItem.name, schema: OrderItemSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: Cart.name, schema: CartSchema },
      { name: CartItem.name, schema: CartItemSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: User.name, schema: UserSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Store.name, schema: StoreSchema },
      { name: Voucher.name, schema: VoucherSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: MembershipLevel.name, schema: MembershipLevelSchema },
      { name: PointTransaction.name, schema: PointTransactionSchema },
      { name: Employee.name, schema: EmployeeSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: Delivery.name, schema: DeliverySchema },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersApiService, OrderReservationExpiryService],
  exports: [OrdersService],
})
export class OrdersModule {}
