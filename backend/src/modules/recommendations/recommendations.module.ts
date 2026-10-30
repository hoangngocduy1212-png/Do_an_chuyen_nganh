import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiClientModule } from '../ai-client/ai-client.module';
import { Category, CategorySchema } from '../categories/schemas/category.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { Inventory, InventorySchema } from '../inventory/schemas/inventory.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [
    AiClientModule,
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
  ],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
})
export class RecommendationsModule {}
