import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { OrderItem, OrderItemSchema } from '../order-items/schemas/order-item.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { Review, ReviewSchema } from './schemas/review.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Review.name, schema: ReviewSchema },
    { name: Order.name, schema: OrderSchema },
    { name: OrderItem.name, schema: OrderItemSchema },
    { name: Product.name, schema: ProductSchema },
    { name: Customer.name, schema: CustomerSchema },
    { name: User.name, schema: UserSchema },
  ])],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
