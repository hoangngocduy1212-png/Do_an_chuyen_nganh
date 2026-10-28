import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cart, CartSchema } from './schemas/cart.schema';
import { CartItem, CartItemSchema } from '../cart-items/schemas/cart-item.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Inventory, InventorySchema } from '../inventory/schemas/inventory.schema';
import { CartsController } from './carts.controller';
import { CartsService } from './carts.service';
import { Category, CategorySchema } from '../categories/schemas/category.schema';
import { Store, StoreSchema } from '../stores/schemas/store.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Cart.name, schema: CartSchema },
    { name: CartItem.name, schema: CartItemSchema },
    { name: Customer.name, schema: CustomerSchema },
    { name: Product.name, schema: ProductSchema },
    { name: Inventory.name, schema: InventorySchema },
    { name: Category.name, schema: CategorySchema },
    { name: Store.name, schema: StoreSchema },
  ])],
  controllers: [CartsController],
  providers: [CartsService],
  exports: [MongooseModule],
})
export class CartsModule {}