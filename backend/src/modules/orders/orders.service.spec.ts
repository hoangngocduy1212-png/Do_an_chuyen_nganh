jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_MINUTE: '* * * * *' },
}));

import { Connection, Model, createConnection } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Counter, CounterSchema } from '../counters/schemas/counter.schema';
import { InventoryService } from '../inventory/inventory.service';
import { Inventory, InventorySchema } from '../inventory/schemas/inventory.schema';
import { OrderItem, OrderItemSchema } from '../order-items/schemas/order-item.schema';
import { OrderReservationExpiryService } from './order-reservation-expiry.service';
import { Order, OrderSchema } from './schemas/order.schema';
import { OrdersService } from './orders.service';

describe('OrdersService inventory lifecycle on standalone MongoDB', () => {
  let server: MongoMemoryServer;
  let connection: Connection;
  let inventoryModel: Model<Inventory>;
  let orderModel: Model<Order>;
  let orderItemModel: Model<OrderItem>;
  let counterModel: Model<Counter>;
  let inventory: InventoryService;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    connection = await createConnection(server.getUri()).asPromise();
    inventoryModel = connection.model<Inventory>(Inventory.name, InventorySchema);
    orderModel = connection.model<Order>(Order.name, OrderSchema);
    orderItemModel = connection.model<OrderItem>(OrderItem.name, OrderItemSchema);
    counterModel = connection.model<Counter>(Counter.name, CounterSchema);
    inventory = new InventoryService(inventoryModel);
  }, 120_000);

  afterAll(async () => {
    await connection?.close();
    await server?.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      inventoryModel.deleteMany({}),
      orderModel.deleteMany({}),
      orderItemModel.deleteMany({}),
      counterModel.deleteMany({}),
    ]);
  });

  it('dùng thao tác tuần tự và hoàn tác tồn khi MongoDB không hỗ trợ transaction', async () => {
    await inventoryModel.create({ storeId: 'store-test', productId: 'product-test', quantity: 5, reservedQuantity: 0 });
    const orders = new OrdersService(connection, orderModel, orderItemModel, counterModel, inventory);

    const order = await orders.createWithReservation({
      order: {
        customerId: 'customer-test',
        storeId: 'store-test',
        receiveMethod: 'DELIVERY',
        orderStatus: 'PENDING',
        recipientName: 'Khách thử nghiệm',
        recipientPhone: '0900000000',
        subtotal: 20000,
        discountAmount: 0,
        shippingFee: 20000,
        totalAmount: 40000,
        initialDiscountAmount: 0,
        paidAmount: 0,
        amountDue: 40000,
        paymentMethod: 'TRANSFER',
        paymentStatus: 'PENDING',
      },
      items: [{
        productId: 'product-test',
        productName: 'Sản phẩm thử nghiệm',
        image: '',
        unit: 'gói',
        unitPrice: 20000,
        quantity: 1,
        lineTotal: 20000,
      }],
      reservation: [{ storeId: 'store-test', productId: 'product-test', quantity: 1 }],
    });

    expect(order.orderCode).toMatch(/^MD\d{9}$/);
    expect(order.statusHistory).toHaveLength(1);
    expect(order.reservationExpiresAt?.getTime()).toBeGreaterThan(Date.now());
    expect(await orderItemModel.countDocuments({ orderId: order._id.toString() })).toBe(1);
    expect((await inventoryModel.findOne({ productId: 'product-test' }).lean().exec())?.reservedQuantity).toBe(1);
  });

  it('đơn CASH giữ tồn nhưng không đặt thời hạn hết reservation', async () => {
    await inventoryModel.create({ storeId: 'store-test', productId: 'product-test', quantity: 5, reservedQuantity: 0 });
    const orders = new OrdersService(connection, orderModel, orderItemModel, counterModel, inventory);

    const order = await orders.createWithReservation({
      order: {
        customerId: 'customer-test',
        storeId: 'store-test',
        receiveMethod: 'PICKUP',
        orderStatus: 'PENDING',
        recipientName: 'Khách thử nghiệm',
        recipientPhone: '0900000000',
        subtotal: 10000,
        discountAmount: 0,
        shippingFee: 0,
        totalAmount: 10000,
        initialDiscountAmount: 0,
        paidAmount: 0,
        amountDue: 10000,
        paymentMethod: 'CASH',
        paymentStatus: 'PENDING',
      },
      items: [],
      reservation: [{ storeId: 'store-test', productId: 'product-test', quantity: 1 }],
    });

    expect(order.reservationExpiresAt).toBeUndefined();
    expect((await inventoryModel.findOne({ productId: 'product-test' }).lean().exec())?.reservedQuantity).toBe(1);
  });

  it('tự hủy đơn PENDING quá hạn và trả lại lượng tồn đã giữ', async () => {
    await inventoryModel.create({ storeId: 'store-test', productId: 'product-test', quantity: 5, reservedQuantity: 2 });
    const [order] = await orderModel.create([{
      orderCode: 'MD261028998',
      customerId: 'customer-test',
      storeId: 'store-test',
      receiveMethod: 'PICKUP',
      orderStatus: 'PENDING',
      recipientName: 'Khách thử nghiệm',
      recipientPhone: '0900000000',
      subtotal: 20000,
      shippingFee: 0,
      totalAmount: 20000,
      paymentStatus: 'PENDING',
      reservationExpiresAt: new Date(Date.now() - 60_000),
    }]);
    await orderItemModel.create({
      orderId: order._id.toString(),
      productId: 'product-test',
      productName: 'Sản phẩm thử nghiệm',
      image: '',
      unit: 'gói',
      unitPrice: 10000,
      quantity: 2,
      lineTotal: 20000,
    });
    const expiry = new OrderReservationExpiryService(connection, orderModel, orderItemModel, inventory);

    await expiry.expirePendingReservations();

    const updated = await orderModel.findById(order._id).lean().exec();
    const updatedInventory = await inventoryModel.findOne({ productId: 'product-test' }).lean().exec();
    expect(updated?.orderStatus).toBe('CANCELLED');
    expect(updated?.statusHistory.at(-1)?.status).toBe('CANCELLED');
    expect(updatedInventory?.reservedQuantity).toBe(0);
  });
});
