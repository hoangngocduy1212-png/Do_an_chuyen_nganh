import {
  Body,
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  Post,
  Controller,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Connection, Model, createConnection } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { AuthUser } from '../src/common/decorators/current-user.decorator';
import { IS_PUBLIC_KEY, Public } from '../src/common/decorators/public.decorator';
import { Role } from '../src/common/constants/roles';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { CartItem, CartItemSchema } from '../src/modules/cart-items/schemas/cart-item.schema';
import { Category, CategorySchema } from '../src/modules/categories/schemas/category.schema';
import { Cart, CartSchema } from '../src/modules/carts/schemas/cart.schema';
import { CartsController } from '../src/modules/carts/carts.controller';
import { CartsService } from '../src/modules/carts/carts.service';
import { Customer, CustomerSchema } from '../src/modules/customers/schemas/customer.schema';
import { Delivery, DeliverySchema } from '../src/modules/deliveries/schemas/delivery.schema';
import { Employee, EmployeeSchema } from '../src/modules/employees/schemas/employee.schema';
import { Inventory, InventorySchema } from '../src/modules/inventory/schemas/inventory.schema';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { MembershipLevel, MembershipLevelSchema } from '../src/modules/membership-levels/schemas/membership-level.schema';
import { Membership, MembershipSchema } from '../src/modules/memberships/schemas/membership.schema';
import { OrderItem, OrderItemSchema } from '../src/modules/order-items/schemas/order-item.schema';
import { Counter, CounterSchema } from '../src/modules/counters/schemas/counter.schema';
import { OrdersController } from '../src/modules/orders/orders.controller';
import { OrdersApiService } from '../src/modules/orders/orders-api.service';
import { Order, OrderSchema } from '../src/modules/orders/schemas/order.schema';
import { OrdersService } from '../src/modules/orders/orders.service';
import { Payment, PaymentSchema } from '../src/modules/payments/schemas/payment.schema';
import { OrderPaymentsController, PaymentsController } from '../src/modules/payments/payments.controller';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { Product, ProductSchema } from '../src/modules/products/schemas/product.schema';
import { PointTransaction, PointTransactionSchema } from '../src/modules/point-transactions/schemas/point-transaction.schema';
import { Store, StoreSchema } from '../src/modules/stores/schemas/store.schema';
import { User, UserSchema } from '../src/modules/users/schemas/user.schema';
import { Voucher, VoucherSchema } from '../src/modules/vouchers/schemas/voucher.schema';
import { VouchersService } from '../src/modules/vouchers/vouchers.service';

const CUSTOMER = { userId: 'customer-user', role: Role.CUSTOMER } satisfies AuthUser;
const STAFF = { userId: 'staff-user', role: Role.STAFF, storeId: 'store-1' } satisfies AuthUser;
const OTHER_STAFF = { userId: 'other-staff-user', role: Role.STAFF, storeId: 'store-2' } satisfies AuthUser;
const TEST_USERS: Record<string, AuthUser> = {
  'customer-token': CUSTOMER,
  'staff-token': STAFF,
  'other-staff-token': OTHER_STAFF,
};

@Controller('auth')
class TestLoginController {
  @Public()
  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    if (body.password !== 'test-password') throw new UnauthorizedException();
    const token = body.email === 'customer@example.test' ? 'customer-token'
      : body.email === 'staff@example.test' ? 'staff-token'
        : body.email === 'other-staff@example.test' ? 'other-staff-token'
        : undefined;
    if (!token) throw new UnauthorizedException();
    return { accessToken: token };
  }
}

@Injectable()
class TestJwtGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const requestContext = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: AuthUser }>();
    const token = requestContext.headers.authorization?.replace(/^Bearer\s+/i, '');
    const user = token ? TEST_USERS[token] : undefined;
    if (!user) throw new UnauthorizedException();
    requestContext.user = user;
    return true;
  }
}

describe('Order checkout and fulfillment flow (e2e)', () => {
  let app: INestApplication;
  let server: MongoMemoryServer;
  let connection: Connection;
  let models: {
    carts: Model<Cart>;
    cartItems: Model<CartItem>;
    customers: Model<Customer>;
    products: Model<Product>;
    inventory: Model<Inventory>;
    categories: Model<Category>;
    stores: Model<Store>;
    orders: Model<Order>;
    orderItems: Model<OrderItem>;
    counters: Model<Counter>;
    vouchers: Model<Voucher>;
    payments: Model<Payment>;
    memberships: Model<Membership>;
    membershipLevels: Model<MembershipLevel>;
    pointTransactions: Model<PointTransaction>;
    employees: Model<Employee>;
    deliveries: Model<Delivery>;
    users: Model<User>;
  };

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    connection = await createConnection(server.getUri()).asPromise();
    models = {
      carts: connection.model<Cart>(Cart.name, CartSchema),
      cartItems: connection.model<CartItem>(CartItem.name, CartItemSchema),
      customers: connection.model<Customer>(Customer.name, CustomerSchema),
      products: connection.model<Product>(Product.name, ProductSchema),
      inventory: connection.model<Inventory>(Inventory.name, InventorySchema),
      categories: connection.model<Category>(Category.name, CategorySchema),
      stores: connection.model<Store>(Store.name, StoreSchema),
      orders: connection.model<Order>(Order.name, OrderSchema),
      orderItems: connection.model<OrderItem>(OrderItem.name, OrderItemSchema),
      counters: connection.model<Counter>(Counter.name, CounterSchema),
      vouchers: connection.model<Voucher>(Voucher.name, VoucherSchema),
      payments: connection.model<Payment>(Payment.name, PaymentSchema),
      memberships: connection.model<Membership>(Membership.name, MembershipSchema),
      membershipLevels: connection.model<MembershipLevel>(MembershipLevel.name, MembershipLevelSchema),
      pointTransactions: connection.model<PointTransaction>(PointTransaction.name, PointTransactionSchema),
      employees: connection.model<Employee>(Employee.name, EmployeeSchema),
      deliveries: connection.model<Delivery>(Delivery.name, DeliverySchema),
      users: connection.model<User>(User.name, UserSchema),
    };

    const config = {
      get: (key: string) => ({
        'business.freeShipThreshold': 200000,
        'business.defaultShippingFee': 20000,
        'payment.webhookSecret': 'test-webhook-secret-with-at-least-32-characters',
        'payment.bankId': '970422',
        'payment.bankName': 'MB Bank',
        'payment.accountNumber': '123456789',
        'payment.accountName': 'NGUYEN VAN A',
        'payment.cardCheckoutUrl': 'https://checkout.example.test/pay',
        nodeEnv: 'test',
      }[key]),
    } as never;
    const inventoryService = new InventoryService(models.inventory);
    const vouchersService = new VouchersService(models.vouchers);
    const ordersService = new OrdersService(
      connection,
      models.orders,
      models.orderItems,
      models.counters,
      inventoryService,
    );
    const ordersApi = new OrdersApiService(
      connection,
      models.orders,
      models.orderItems,
      models.carts,
      models.cartItems,
      models.customers,
      models.users,
      models.products,
      models.stores,
      models.vouchers,
      models.payments,
      models.memberships,
      models.membershipLevels,
      models.pointTransactions,
      models.employees,
      models.inventory,
      models.deliveries,
      ordersService,
      inventoryService,
      vouchersService,
      config,
    );
    const cartsService = new CartsService(
      models.carts,
      models.cartItems,
      models.customers,
      models.products,
      models.inventory,
      models.categories,
      models.stores,
    );
    const paymentsService = new PaymentsService(
      connection,
      models.payments,
      models.orders,
      models.customers,
      config,
    );
    const reflector = new Reflector();
    const testingModule = await Test.createTestingModule({
      controllers: [
        TestLoginController,
        CartsController,
        OrdersController,
        PaymentsController,
        OrderPaymentsController,
      ],
      providers: [
        { provide: OrdersApiService, useValue: ordersApi },
        { provide: CartsService, useValue: cartsService },
        { provide: PaymentsService, useValue: paymentsService },
      ],
    }).compile();
    app = testingModule.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalGuards(new TestJwtGuard(reflector), new RolesGuard(reflector));
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
    await seedData(models);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await connection?.close();
    await server?.stop();
  });

  it('login → add cart → preview → CASH order → staff fulfillment → loyalty points', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'customer@example.test', password: 'test-password' })
      .expect(201);
    const customerToken = login.body.data.accessToken as string;
    const staffLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'staff@example.test', password: 'test-password' })
      .expect(201);
    const staffToken = staffLogin.body.data.accessToken as string;

    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: 'product-1', quantity: 1, storeId: 'store-1' })
      .expect(201);
    const preview = await request(app.getHttpServer())
      .post('/api/v1/orders/preview')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ storeId: 'store-1', receiveMethod: 'PICKUP' })
      .expect(201);
    expect(preview.body.data).toMatchObject({ subtotal: 10000, totalAmount: 10000, shippingFee: 0 });

    const created = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', 'e2e-order-key-1')
      .send({ storeId: 'store-1', receiveMethod: 'PICKUP', paymentMethod: 'CASH' })
      .expect(201);
    const orderId = created.body.data.orderId as string;
    expect(created.body.data.orderStatus).toBe('PENDING');
    const repeated = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', 'e2e-order-key-1')
      .send({ storeId: 'store-1', receiveMethod: 'PICKUP', paymentMethod: 'CASH' })
      .expect(201);
    expect(repeated.body.data.orderId).toBe(orderId);
    const otherStaffLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'other-staff@example.test', password: 'test-password' })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${otherStaffLogin.body.data.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ orderStatus: 'DELIVERED' })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ orderStatus: 'READY_FOR_PICKUP' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ orderStatus: 'DELIVERED' })
      .expect(200);

    const membership = await models.memberships.findOne({ customerId: 'customer-1' }).lean().exec();
    const pointTransactions = await models.pointTransactions.find({ customerId: 'customer-1' }).lean().exec();
    expect(membership?.pointBalance).toBe(1);
    expect(pointTransactions).toHaveLength(1);
    expect(pointTransactions[0]).toMatchObject({ type: 'EARN', points: 1 });
    expect((await models.orders.findById(orderId).lean().exec())?.paymentStatus).toBe('SUCCESS');

    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: 'product-1', quantity: 1, storeId: 'store-1' })
      .expect(201);
    const cancelOrder = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', 'e2e-cancel-order-key')
      .send({ storeId: 'store-1', receiveMethod: 'PICKUP', paymentMethod: 'CASH' })
      .expect(201);
    expect((await models.inventory.findOne({ productId: 'product-1' }).lean().exec())?.reservedQuantity).toBe(1);
    await request(app.getHttpServer())
      .post(`/api/v1/orders/${cancelOrder.body.data.orderId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ reason: 'Khách đổi ý' })
      .expect(201);
    expect((await models.inventory.findOne({ productId: 'product-1' }).lean().exec())?.reservedQuantity).toBe(0);
  });

  it('requires actual weight within the limit and recalculates both additional due and refund amounts', async () => {
    await models.products.create({
      productId: 'product-kg',
      productName: 'Hàng cân thử',
      description: 'Sản phẩm kiểm thử theo cân',
      categoryId: 'category-1',
      price: 10000,
      image: '',
      unit: 'kg',
      status: 'ACTIVE',
    });
    await models.inventory.create({
      storeId: 'store-1',
      productId: 'product-kg',
      quantity: 5,
      reservedQuantity: 0,
    });
    await models.carts.updateOne(
      { customerId: 'customer-1' },
      { $set: { storeId: undefined, totalAmount: 0 } },
    ).exec();
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'customer@example.test', password: 'test-password' })
      .expect(201);
    const customerToken = login.body.data.accessToken as string;
    const staffLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'staff@example.test', password: 'test-password' })
      .expect(201);
    const staffToken = staffLogin.body.data.accessToken as string;

    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: 'product-kg', quantity: 1, storeId: 'store-1' })
      .expect(201);
    const created = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .set('Idempotency-Key', 'e2e-weight-order-key')
      .send({ storeId: 'store-1', receiveMethod: 'PICKUP', paymentMethod: 'TRANSFER' })
      .expect(201);
    const orderId = created.body.data.orderId as string;
    const payment = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderId, paymentMethod: 'TRANSFER' })
      .expect(201);
    expect(payment.body.data).toMatchObject({
      paymentMethod: 'TRANSFER',
      amount: 10000,
      bankName: 'MB Bank',
    });
    const paymentId = payment.body.data.paymentId as string;
    await request(app.getHttpServer())
      .get(`/api/v1/payments/${paymentId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const item = await models.orderItems.findOne({ orderId }).exec();
    expect(item).toBeTruthy();

    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/items/${String(item?._id)}/weight`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ actualWeight: 1.3 })
      .expect(409);
    const increased = await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/items/${String(item?._id)}/weight`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ actualWeight: 1.1 })
      .expect(200);
    expect(increased.body.data.amountDue).toBe(11000);

    await models.payments.updateOne(
      { orderId, paymentStatus: 'PENDING' },
      { $set: { paymentStatus: 'SUCCESS', amount: 12000, transactionCode: 'weight-payment-success' } },
    ).exec();
    await models.orders.updateOne(
      { _id: orderId },
      { $set: { paidAmount: 12000, paymentStatus: 'SUCCESS' } },
    ).exec();
    const decreased = await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/items/${String(item?._id)}/weight`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ actualWeight: 0.9 })
      .expect(200);
    expect(decreased.body.data.amountDue).toBe(0);
    expect(decreased.body.data.paidAmount).toBe(9000);
    expect(await models.payments.findOne({ orderId, paymentStatus: 'REFUNDED' }).lean().exec())
      .toMatchObject({ amount: 3000 });
  });
});

async function seedData(models: {
  customers: Model<Customer>;
  products: Model<Product>;
  inventory: Model<Inventory>;
  categories: Model<Category>;
  stores: Model<Store>;
  carts: Model<Cart>;
  users: Model<User>;
  employees: Model<Employee>;
  memberships: Model<Membership>;
  membershipLevels: Model<MembershipLevel>;
}): Promise<void> {
  await models.users.create([
    { userId: CUSTOMER.userId, fullName: 'Khách thử', email: 'customer@example.test', phone: '0900000000', password: 'not-used' },
    { userId: STAFF.userId, fullName: 'Nhân viên thử', email: 'staff@example.test', password: 'not-used', role: Role.STAFF },
    { userId: OTHER_STAFF.userId, fullName: 'Nhân viên cửa hàng khác', email: 'other-staff@example.test', password: 'not-used', role: Role.STAFF },
  ]);
  await models.customers.create({ customerId: 'customer-1', userId: CUSTOMER.userId });
  await models.employees.create({
    userId: STAFF.userId,
    employeeCode: 'EMP-TEST',
    employeeRole: 'STAFF',
    storeId: 'store-1',
  });
  await models.categories.create({ categoryId: 'category-1', categoryName: 'Thực phẩm' });
  await models.stores.create({
    storeId: 'store-1',
    storeName: 'Cửa hàng thử',
    address: 'Địa chỉ thử',
    phone: '0900000000',
    status: 'ACTIVE',
    shippingFee: { baseFee: 20000 },
  });
  await models.products.create({
    productId: 'product-1',
    productName: 'Sản phẩm thử',
    description: 'Sản phẩm kiểm thử',
    categoryId: 'category-1',
    price: 10000,
    image: '',
    unit: 'cái',
    status: 'ACTIVE',
  });
  await models.inventory.create({
    storeId: 'store-1',
    productId: 'product-1',
    quantity: 5,
    reservedQuantity: 0,
  });
  await models.carts.create({ cartId: 'cart-1', customerId: 'customer-1' });
  await models.membershipLevels.create({ name: 'Thường', minPoints: 0, sortOrder: 1 });
  await models.memberships.create({
    customerId: 'customer-1',
    memberCode: 'MEM-TEST',
    pointBalance: 0,
    lifetimePoints: 0,
    memberLevel: 'Thường',
  });
}
