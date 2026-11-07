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
import { EmployeesController } from '../src/modules/employees/employees.controller';
import { EmployeesService } from '../src/modules/employees/employees.service';
import { EmployeeOperationsService } from '../src/modules/employees/employee-operations.service';
import { Review, ReviewSchema } from '../src/modules/reviews/schemas/review.schema';
import { ChatSession, ChatSessionSchema } from '../src/modules/chat-sessions/schemas/chat-session.schema';
import { ChatMessage, ChatMessageSchema } from '../src/modules/chat-messages/schemas/chat-message.schema';
import { ChatService } from '../src/modules/chat/chat.service';
import { OrderIssue, OrderIssueSchema } from '../src/modules/employees/schemas/order-issue.schema';
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
const ADMIN = { userId: 'admin-user', role: Role.ADMIN } satisfies AuthUser;
const STAFF = { userId: 'staff-user', role: Role.STAFF, storeId: 'store-1' } satisfies AuthUser;
const OTHER_STAFF = { userId: 'other-staff-user', role: Role.STAFF, storeId: 'store-2' } satisfies AuthUser;
const COWORKER = { userId: 'coworker-user', role: Role.STAFF, storeId: 'store-1' } satisfies AuthUser;
const TEST_USERS: Record<string, AuthUser> = {
  'customer-token': CUSTOMER,
  'admin-token': ADMIN,
  'staff-token': STAFF,
  'other-staff-token': OTHER_STAFF,
  'coworker-token': COWORKER,
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
  let chatService: ChatService;
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
    reviews: Model<Review>;
    chatSessions: Model<ChatSession>;
    chatMessages: Model<ChatMessage>;
    orderIssues: Model<OrderIssue>;
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
      reviews: connection.model<Review>(Review.name, ReviewSchema),
      chatSessions: connection.model<ChatSession>(ChatSession.name, ChatSessionSchema),
      chatMessages: connection.model<ChatMessage>(ChatMessage.name, ChatMessageSchema),
      orderIssues: connection.model<OrderIssue>(OrderIssue.name, OrderIssueSchema),
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
      models.memberships,
    );
    const paymentsService = new PaymentsService(
      connection,
      models.payments,
      models.orders,
      models.customers,
      config,
    );
    const employeesService = new EmployeesService(models.employees, models.stores, {
      getProfile: async (userId: string) => (await models.users.findOne({ userId }).exec())!.toJSON(),
      updateProfile: async (userId: string, dto: { fullName?: string }) => models.users.updateOne({ userId }, { $set: dto }).exec(),
    } as never);
    const employeeOperations = new EmployeeOperationsService(models.employees, models.orders, models.reviews,
      models.products, models.chatSessions, models.chatMessages, models.orderIssues);
    chatService = new ChatService({} as never, {} as never, models.chatSessions, models.chatMessages,
      models.customers, models.orders, models.products, models.employees, models.users, models.stores);
    const reflector = new Reflector();
    const testingModule = await Test.createTestingModule({
      controllers: [
        TestLoginController,
        CartsController,
        OrdersController,
        PaymentsController,
        OrderPaymentsController,
        EmployeesController,
      ],
      providers: [
        { provide: OrdersApiService, useValue: ordersApi },
        { provide: CartsService, useValue: cartsService },
        { provide: PaymentsService, useValue: paymentsService },
        { provide: EmployeesService, useValue: employeesService },
        { provide: EmployeeOperationsService, useValue: employeeOperations },
        { provide: VouchersService, useValue: vouchersService },
        { provide: InventoryService, useValue: inventoryService },
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

  it('lets an admin shop with a separate customer profile and preserves staff restrictions', async () => {
    await models.users.create({ userId: ADMIN.userId, fullName: 'Admin', email: 'admin@example.test', phone: '0900000001', password: 'unused', role: Role.ADMIN });
    const auth = 'Bearer admin-token';
    await request(app.getHttpServer()).get('/api/v1/cart').set('Authorization', auth).expect(200);
    const customer = await models.customers.findOne({ userId: ADMIN.userId }).lean().exec();
    expect(customer).toBeTruthy();
    expect(await models.memberships.findOne({ customerId: customer!.customerId }).lean().exec()).toBeTruthy();
    await request(app.getHttpServer()).post('/api/v1/cart/items').set('Authorization', auth)
      .send({ productId: 'product-1', quantity: 1, storeId: 'store-1' }).expect(201);
    await request(app.getHttpServer()).post('/api/v1/orders/preview').set('Authorization', auth)
      .send({ storeId: 'store-1', receiveMethod: 'PICKUP' }).expect(201);
    const order = await request(app.getHttpServer()).post('/api/v1/orders').set('Authorization', auth)
      .set('Idempotency-Key', 'admin-shopping-test')
      .send({ storeId: 'store-1', receiveMethod: 'PICKUP', paymentMethod: 'CASH' }).expect(201);
    const mine = await request(app.getHttpServer()).get('/api/v1/orders/my').set('Authorization', auth).expect(200);
    expect(mine.body.data.some((item: { orderId: string }) => item.orderId === order.body.data.orderId)).toBe(true);
    await request(app.getHttpServer()).post(`/api/v1/orders/${order.body.data.orderId}/cancel`).set('Authorization', auth)
      .send({ reason: 'test' }).expect(201);
    await request(app.getHttpServer()).get('/api/v1/cart').set('Authorization', 'Bearer staff-token').expect(403);
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

    const staffProfile = await request(app.getHttpServer())
      .get('/api/v1/employees/me').set('Authorization', `Bearer ${staffToken}`).expect(200);
    expect(staffProfile.body.data.employee.storeId).toBe('store-1');
    expect(staffProfile.body.data.user.password).toBeUndefined();
    const updatedProfile = await request(app.getHttpServer()).patch('/api/v1/employees/me')
      .set('Authorization', `Bearer ${staffToken}`).send({ fullName: 'Updated Staff' }).expect(200);
    expect(updatedProfile.body.data.user.fullName).toBe('Updated Staff');
    await request(app.getHttpServer()).patch('/api/v1/employees/me')
      .set('Authorization', `Bearer ${staffToken}`).send({ storeId: 'store-2' }).expect(400);
    await request(app.getHttpServer()).get('/api/v1/employees/me')
      .set('Authorization', `Bearer ${customerToken}`).expect(403);
    const inventory = await request(app.getHttpServer()).get('/api/v1/employees/me/inventory?storeId=store-2')
      .set('Authorization', `Bearer ${staffToken}`).expect(200);
    expect(inventory.body.data.every((item: { storeId: string }) => item.storeId === 'store-1')).toBe(true);

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
    await request(app.getHttpServer()).post(`/api/v1/employees/me/orders/${orderId}/issues`)
      .set('Authorization', 'Bearer other-staff-token').send({ type: 'OUT_OF_STOCK', detail: 'Out of stock' }).expect(404);
    const issue = await request(app.getHttpServer()).post(`/api/v1/employees/me/orders/${orderId}/issues`)
      .set('Authorization', `Bearer ${staffToken}`).send({ type: 'OUT_OF_STOCK', detail: 'Out of stock' }).expect(201);
    expect(issue.body.data.status).toBe('OPEN');
    await request(app.getHttpServer()).post(`/api/v1/employees/me/issues/${issue.body.data.issueId}/resolve`)
      .set('Authorization', 'Bearer other-staff-token').expect(404);
    const resolved = await request(app.getHttpServer()).post(`/api/v1/employees/me/issues/${issue.body.data.issueId}/resolve`)
      .set('Authorization', `Bearer ${staffToken}`).expect(201);
    expect(resolved.body.data.status).toBe('RESOLVED');
    const staffOrders = await request(app.getHttpServer()).get('/api/v1/employees/me/orders?storeId=store-2')
      .set('Authorization', `Bearer ${staffToken}`).expect(200);
    expect(staffOrders.body.data.some((item: { orderId: string }) => item.orderId === orderId)).toBe(true);
    await request(app.getHttpServer()).post(`/api/v1/orders/${orderId}/cancel`)
      .set('Authorization', 'Bearer admin-token').send({ reason: 'test' }).expect(404);
    await request(app.getHttpServer()).post('/api/v1/payments')
      .set('Authorization', 'Bearer admin-token').send({ orderId, paymentMethod: 'TRANSFER' }).expect(404);
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
    await request(app.getHttpServer()).get(`/api/v1/employees/me/orders/${orderId}`)
      .set('Authorization', `Bearer ${otherStaffLogin.body.data.accessToken}`).expect(404);
    await request(app.getHttpServer()).post(`/api/v1/employees/me/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${otherStaffLogin.body.data.accessToken}`).expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/employees/me/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ orderStatus: 'DELIVERED' })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/employees/me/orders/${orderId}/accept`)
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

    // Đánh giá chỉ được quản lý bởi nhân viên của cửa hàng xử lý đơn gốc.
    const review = await models.reviews.create({ customerId: 'customer-1', orderId, productId: 'product-1', rating: 4, comment: 'Test' });
    await request(app.getHttpServer()).patch(`/api/v1/employees/me/reviews/${review._id}/visibility`)
      .set('Authorization', 'Bearer other-staff-token').send({ isHidden: true }).expect(404);
    const reviews = await request(app.getHttpServer()).get('/api/v1/employees/me/reviews')
      .set('Authorization', `Bearer ${staffToken}`).expect(200);
    expect(reviews.body.data).toHaveLength(1);
    await request(app.getHttpServer()).patch(`/api/v1/employees/me/reviews/${review._id}/visibility`)
      .set('Authorization', `Bearer ${staffToken}`).send({ isHidden: true }).expect(200);
    expect((await models.products.findOne({ productId: 'product-1' }).lean().exec())?.reviewCount).toBe(0);
    await request(app.getHttpServer()).patch(`/api/v1/employees/me/reviews/${review._id}/visibility`)
      .set('Authorization', `Bearer ${staffToken}`).send({ isHidden: false }).expect(200);
    expect((await models.products.findOne({ productId: 'product-1' }).lean().exec())?.reviewCount).toBe(1);

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
    await models.orders.updateOne({ _id: cancelOrder.body.data.orderId }, { $set: { paidAmount: 1000 } }).exec();
    await request(app.getHttpServer()).post(`/api/v1/employees/me/orders/${cancelOrder.body.data.orderId}/cancel`)
      .set('Authorization', `Bearer ${staffToken}`).send({ reason: 'test' }).expect(409);
    await models.orders.updateOne({ _id: cancelOrder.body.data.orderId }, { $set: { paidAmount: 0 } }).exec();
    await request(app.getHttpServer())
      .post(`/api/v1/employees/me/orders/${cancelOrder.body.data.orderId}/cancel`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reason: 'Khách đổi ý' })
      .expect(201);
    expect((await models.inventory.findOne({ productId: 'product-1' }).lean().exec())?.reservedQuantity).toBe(0);
  });

  it('allows staff to claim and answer only support sessions in their store', async () => {
    await models.employees.create({ userId: COWORKER.userId, employeeCode: 'EMP-COWORKER', employeeRole: 'STAFF', storeId: 'store-1' });
    const session = await chatService.createSession(CUSTOMER);
    const sessionId = session.sessionId;
    await expect(chatService.handover(sessionId, CUSTOMER)).rejects.toMatchObject({ status: 400 });
    await chatService.handover(sessionId, CUSTOMER, 'store-1');
    const base = '/api/v1/employees/me/support/sessions';
    const other = await request(app.getHttpServer()).get(base).set('Authorization', 'Bearer other-staff-token').expect(200);
    expect(other.body.data).toHaveLength(0);
    await request(app.getHttpServer()).post(`${base}/${sessionId}/claim`).set('Authorization', 'Bearer other-staff-token').expect(404);
    await request(app.getHttpServer()).post(`${base}/${sessionId}/claim`).set('Authorization', 'Bearer staff-token').expect(201);
    await request(app.getHttpServer()).post(`${base}/${sessionId}/claim`).set('Authorization', 'Bearer coworker-token').expect(409);
    await request(app.getHttpServer()).post(`${base}/${sessionId}/messages`).set('Authorization', 'Bearer coworker-token')
      .send({ content: 'Hello' }).expect(404);
    const message = await request(app.getHttpServer()).post(`${base}/${sessionId}/messages`).set('Authorization', 'Bearer staff-token')
      .send({ content: 'Xin chao' }).expect(201);
    expect(message.body.data.senderType).toBe('STAFF');
    expect((await chatService.history(sessionId, CUSTOMER)).messages[0]).toMatchObject({ role: 'staff', content: 'Xin chao' });
    const history = await request(app.getHttpServer()).get(`${base}/${sessionId}/messages`).set('Authorization', 'Bearer staff-token').expect(200);
    expect(history.body.data).toHaveLength(1);
    await request(app.getHttpServer()).post(`${base}/${sessionId}/close`).set('Authorization', 'Bearer staff-token').expect(201);
    await request(app.getHttpServer()).post(`${base}/${sessionId}/messages`).set('Authorization', 'Bearer staff-token')
      .send({ content: 'After close' }).expect(404);
  });

  it('lets staff manage vouchers while rejecting customer access', async () => {
    const base = '/api/v1/employees/me/vouchers';
    await request(app.getHttpServer()).get(base).set('Authorization', 'Bearer customer-token').expect(403);
    const voucher = await request(app.getHttpServer()).post(base).set('Authorization', 'Bearer staff-token').send({
      code: 'STAFF-TEST', description: 'test', discountValue: 1000,
      startDate: '2026-01-01T00:00:00.000Z', endDate: '2027-01-01T00:00:00.000Z',
    }).expect(201);
    const voucherId = voucher.body.data.voucherId;
    await request(app.getHttpServer()).patch(`${base}/${voucherId}`).set('Authorization', 'Bearer staff-token')
      .send({ description: 'updated' }).expect(200);
    await request(app.getHttpServer()).delete(`${base}/${voucherId}`).set('Authorization', 'Bearer staff-token').expect(200);
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
      .patch(`/api/v1/employees/me/orders/${orderId}/items/${String(item?._id)}/weight`)
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
  await models.employees.create({ userId: OTHER_STAFF.userId, employeeCode: 'EMP-OTHER', employeeRole: 'STAFF', storeId: 'store-2' });
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
