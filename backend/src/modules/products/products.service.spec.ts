import { Connection, Model, createConnection } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Category, CategorySchema } from '../categories/schemas/category.schema';
import { Inventory, InventorySchema } from '../inventory/schemas/inventory.schema';
import { OrderItem, OrderItemSchema } from '../order-items/schemas/order-item.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { ProductQueryDto } from './dto/product.dto';
import { Product, ProductSchema } from './schemas/product.schema';
import { ProductsService } from './products.service';
import { Role } from '../../common/constants/roles';

describe('ProductsService', () => {
  let server: MongoMemoryServer;
  let connection: Connection;
  let models: {
    products: Model<Product>;
    categories: Model<Category>;
    inventory: Model<Inventory>;
    orders: Model<Order>;
    orderItems: Model<OrderItem>;
  };
  let service: ProductsService;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    connection = await createConnection(server.getUri()).asPromise();
    models = {
      products: connection.model<Product>(Product.name, ProductSchema),
      categories: connection.model<Category>(Category.name, CategorySchema),
      inventory: connection.model<Inventory>(Inventory.name, InventorySchema),
      orders: connection.model<Order>(Order.name, OrderSchema),
      orderItems: connection.model<OrderItem>(OrderItem.name, OrderItemSchema),
    };
    service = new ProductsService(
      models.products,
      models.categories,
      models.inventory,
      models.orders,
      models.orderItems,
    );
  }, 120_000);

  afterAll(async () => {
    await connection?.close();
    await server?.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      models.products.deleteMany({}),
      models.categories.deleteMany({}),
      models.inventory.deleteMany({}),
      models.orders.deleteMany({}),
      models.orderItems.deleteMany({}),
    ]);
  });

  it('tìm không dấu, chỉ trả sản phẩm ACTIVE, giá sale và tồn khả dụng', async () => {
    await models.categories.create({
      categoryId: 'category-test',
      categoryName: 'Rau củ',
    });
    const [product] = await models.products.create([{
      productId: 'product-test',
      productName: 'Cà chua',
      description: 'Tươi mỗi ngày',
      categoryId: 'category-test',
      price: 30000,
      salePrice: 25000,
      saleStartDate: new Date(Date.now() - 60_000),
      saleEndDate: new Date(Date.now() + 60_000),
      unit: 'kg',
      status: 'ACTIVE',
    }]);
    await models.products.create({
      productId: 'inactive-product',
      productName: 'Cà rốt',
      description: 'Không bán',
      categoryId: 'category-test',
      price: 10000,
      unit: 'kg',
      status: 'INACTIVE',
    });
    await models.inventory.create({
      storeId: 'store-test',
      productId: product.productId,
      quantity: 10,
      reservedQuantity: 2,
    });

    const query = Object.assign(new ProductQueryDto(), {
      q: 'ca chua',
      storeId: 'store-test',
      page: 1,
      limit: 20,
    });
    const result = await service.findAll(query);

    expect(result.meta.total).toBe(1);
    expect(result.data[0]).toMatchObject({
      productId: 'product-test',
      categoryName: 'Rau củ',
      stock: 8,
      salePrice: 25000,
      avgRating: 0,
      reviewCount: 0,
    });
    expect(result.data[0]).not.toHaveProperty('searchText');
  });

  it('cho phép ADMIN xem sản phẩm INACTIVE để có thể sửa hoặc kích hoạt lại', async () => {
    await models.categories.create({ categoryId: 'category-test', categoryName: 'Rau củ' });
    await models.products.create([
      {
        productId: 'active-product',
        productName: 'Cà chua',
        description: 'Đang bán',
        categoryId: 'category-test',
        price: 30000,
        unit: 'kg',
        status: 'ACTIVE',
      },
      {
        productId: 'inactive-product',
        productName: 'Cà rốt',
        description: 'Ngừng bán',
        categoryId: 'category-test',
        price: 25000,
        unit: 'kg',
        status: 'INACTIVE',
      },
    ]);

    const query = Object.assign(new ProductQueryDto(), { page: 1, limit: 20 });
    const publicResult = await service.findAll(query);
    const adminResult = await service.findAll(query, { userId: 'admin-test', role: Role.ADMIN });

    expect(publicResult.data.map((item) => item.productId).sort()).toEqual(['active-product']);
    expect(adminResult.data.map((item) => item.productId).sort()).toEqual(['active-product', 'inactive-product']);
  });

  it('xếp bestseller theo số lượng DELIVERED trong 30 ngày gần nhất của cửa hàng', async () => {
    await models.categories.create({ categoryId: 'category-test', categoryName: 'Đồ khô' });
    const products = await models.products.create([
      {
        productId: 'product-a',
        productName: 'Sản phẩm A',
        description: 'Mô tả A',
        categoryId: 'category-test',
        price: 10000,
        unit: 'gói',
        status: 'ACTIVE',
        soldCount: 100,
      },
      {
        productId: 'product-b',
        productName: 'Sản phẩm B',
        description: 'Mô tả B',
        categoryId: 'category-test',
        price: 10000,
        unit: 'gói',
        status: 'ACTIVE',
        soldCount: 1,
      },
    ]);
    const [order] = await models.orders.create([{
      orderCode: 'MD261028001',
      customerId: 'customer-test',
      storeId: 'store-test',
      receiveMethod: 'PICKUP',
      orderStatus: 'DELIVERED',
      recipientName: 'Khách thử',
      recipientPhone: '0900000000',
      subtotal: 10000,
      totalAmount: 10000,
      paymentStatus: 'SUCCESS',
      createdAt: new Date(),
    }]);
    await models.orderItems.create([
      { orderId: order._id.toString(), productId: products[1].productId, productName: 'B', unit: 'gói', unitPrice: 10000, quantity: 4, lineTotal: 40000 },
      { orderId: order._id.toString(), productId: products[0].productId, productName: 'A', unit: 'gói', unitPrice: 10000, quantity: 1, lineTotal: 10000 },
    ]);

    const query = Object.assign(new ProductQueryDto(), {
      collection: 'bestseller',
      storeId: 'store-test',
      page: 1,
      limit: 20,
    });
    const result = await service.findAll(query);

    expect(result.data.map((item) => item.productId)).toEqual(['product-b', 'product-a']);
    expect(result.data.map((item) => item.soldCount)).toEqual([4, 1]);
  });
});
