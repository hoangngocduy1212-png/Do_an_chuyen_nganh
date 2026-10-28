import { Connection, Model, createConnection } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { CartItem, CartItemSchema } from '../cart-items/schemas/cart-item.schema';
import { Category, CategorySchema } from '../categories/schemas/category.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { Inventory, InventorySchema } from '../inventory/schemas/inventory.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Store, StoreSchema } from '../stores/schemas/store.schema';
import { Cart, CartSchema } from './schemas/cart.schema';
import { CartsService } from './carts.service';

describe('CartsService', () => {
  let server: MongoMemoryServer;
  let connection: Connection;
  let models: {
    carts: Model<Cart>;
    items: Model<CartItem>;
    customers: Model<Customer>;
    products: Model<Product>;
    inventory: Model<Inventory>;
    categories: Model<Category>;
    stores: Model<Store>;
  };
  let service: CartsService;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    connection = await createConnection(server.getUri()).asPromise();
    models = {
      carts: connection.model<Cart>(Cart.name, CartSchema),
      items: connection.model<CartItem>(CartItem.name, CartItemSchema),
      customers: connection.model<Customer>(Customer.name, CustomerSchema),
      products: connection.model<Product>(Product.name, ProductSchema),
      inventory: connection.model<Inventory>(Inventory.name, InventorySchema),
      categories: connection.model<Category>(Category.name, CategorySchema),
      stores: connection.model<Store>(Store.name, StoreSchema),
    };
    service = new CartsService(
      models.carts,
      models.items,
      models.customers,
      models.products,
      models.inventory,
      models.categories,
      models.stores,
    );
  }, 120_000);

  afterAll(async () => {
    await connection?.close();
    await server?.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      models.carts.deleteMany({}),
      models.items.deleteMany({}),
      models.customers.deleteMany({}),
      models.products.deleteMany({}),
      models.inventory.deleteMany({}),
      models.categories.deleteMany({}),
      models.stores.deleteMany({}),
    ]);
  });

  it('cộng dồn giỏ hàng, tự giới hạn lượng cân và báo thay đổi giá/tồn', async () => {
    await models.customers.create({ userId: 'user-test', customerId: 'customer-test' });
    const [store] = await models.stores.create([{
      storeId: 'store-test',
      storeName: 'Cửa hàng thử',
      address: 'Địa chỉ',
      phone: '0900000000',
      shippingFee: { baseFee: 20000 },
    }]);
    const [product] = await models.products.create([{
      productId: 'product-test',
      productName: 'Cà chua',
      description: 'Tươi',
      categoryId: 'category-test',
      price: 30000,
      unit: 'kg',
      status: 'ACTIVE',
    }]);
    await models.inventory.create({
      storeId: store.storeId,
      productId: product.productId,
      quantity: 1.8,
      reservedQuantity: 0,
    });

    const added = await service.addItem('user-test', {
      productId: product.productId,
      quantity: 2,
      storeId: store.storeId,
    });
    expect(added.quantity).toBe(1.5);
    expect(added.quantityAdjusted).toBe(true);
    expect(added.stock).toBe(1.8);

    await models.products.updateOne({ productId: product.productId }, { $set: { price: 35000 } });
    const cart = await service.get('user-test');
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].priceChanged).toBe(true);
    expect(cart.items[0].itemId).toBe(added.itemId);
    expect((await service.validate('user-test')).valid).toBe(false);
    await expect(service.addItem('user-test', {
      productId: product.productId,
      quantity: 0.5,
      storeId: 'another-store',
    })).rejects.toMatchObject({
      response: { code: 'CART_STORE_MISMATCH' },
    });
  });
});
