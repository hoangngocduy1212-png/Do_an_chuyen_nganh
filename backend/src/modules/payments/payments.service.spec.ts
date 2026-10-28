import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Connection, Model, createConnection } from 'mongoose';
import { createHmac } from 'crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { PaymentsService } from './payments.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/constants/roles';

const secret = 'test-payment-webhook-secret-minimum-32-characters';

describe('PaymentsService', () => {
  let server: MongoMemoryServer;
  let connection: Connection;
  let paymentModel: Model<Payment>;
  let orderModel: Model<Order>;
  let customerModel: Model<Customer>;
  let service: PaymentsService;
  let orderId: string;
  let paymentId: string;
  const customerUser: AuthUser = { userId: 'user-customer', role: Role.CUSTOMER };
  const config = {
    get: (key: string) => ({
      'payment.webhookSecret': secret,
      'payment.bankId': '970422',
      'payment.bankName': 'MB Bank',
      'payment.accountNumber': '123456789',
      'payment.accountName': 'NGUYEN VAN A',
      'payment.cardCheckoutUrl': 'https://checkout.example.test/pay',
      nodeEnv: 'test',
    }[key]),
  } as ConfigService;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    connection = await createConnection(server.getUri()).asPromise();
    paymentModel = connection.model<Payment>(Payment.name, PaymentSchema);
    orderModel = connection.model<Order>(Order.name, OrderSchema);
    customerModel = connection.model<Customer>(Customer.name, CustomerSchema);
    service = new PaymentsService(connection, paymentModel, orderModel, customerModel, config);
  }, 120_000);

  afterAll(async () => {
    await connection?.close();
    await server?.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      paymentModel.deleteMany({}),
      orderModel.deleteMany({}),
      customerModel.deleteMany({}),
    ]);
    await customerModel.create({ customerId: 'customer-1', userId: customerUser.userId });
    const order = await orderModel.create({
      orderCode: 'ORD-TEST-1',
      customerId: 'customer-1',
      storeId: 'store-1',
      receiveMethod: 'DELIVERY',
      orderStatus: 'PENDING',
      recipientName: 'Test',
      recipientPhone: '0900000000',
      subtotal: 25000,
      totalAmount: 25000,
      amountDue: 25000,
      paidAmount: 0,
      paymentMethod: 'TRANSFER',
      paymentStatus: 'PENDING',
      reservationExpiresAt: new Date(Date.now() + 15 * 60_000),
    });
    orderId = String(order._id);
    const payment = await paymentModel.create({
      orderId,
      paymentMethod: 'TRANSFER',
      paymentStatus: 'PENDING',
      amount: 25000,
      expiresAt: new Date(Date.now() + 15 * 60_000),
    });
    paymentId = String(payment._id);
  });

  it('creates a VietQR transfer payment and reuses the pending payment on retry', async () => {
    const first = await service.create(customerUser, { orderId, paymentMethod: 'TRANSFER' });
    const retry = await service.create(customerUser, { orderId, paymentMethod: 'TRANSFER' });

    expect(first).toMatchObject({
      paymentId,
      amount: 25000,
      bankName: 'MB Bank',
      accountNumber: '123456789',
      transferContent: 'ORD-TEST-1',
    });
    expect(first.qrCodeUrl).toContain('img.vietqr.io/image/970422-123456789-compact2.png');
    expect(first.qrCodeUrl).toContain('amount=25000');
    expect(retry.paymentId).toBe(first.paymentId);
    expect(await paymentModel.countDocuments({ orderId })).toBe(1);
  });

  it('rejects payment data for an order owned by another customer', async () => {
    const other: AuthUser = { userId: 'another-user', role: Role.CUSTOMER };
    await expect(service.getOne(other, paymentId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not create an online transaction for CASH orders', async () => {
    await orderModel.updateOne({ _id: orderId }, { $set: { paymentMethod: 'CASH' } }).exec();
    await expect(service.create(customerUser, { orderId, paymentMethod: 'CASH' }))
      .rejects.toMatchObject({ response: { code: 'PAYMENT_METHOD_UNSUPPORTED' } });
  });

  it('rejects invalid HMAC signatures and amount mismatches', async () => {
    const event = { paymentId, transactionCode: 'tx-1', amount: 25000, status: 'SUCCESS' as const };
    const raw = Buffer.from(JSON.stringify(event));
    await expect(service.handleWebhook('bank', event, raw, '00'.repeat(32)))
      .rejects.toBeInstanceOf(BadRequestException);
    const wrongAmount = { ...event, amount: 24999 };
    const wrongRaw = Buffer.from(JSON.stringify(wrongAmount));
    await expect(service.handleWebhook('bank', wrongAmount, wrongRaw, sign(wrongRaw)))
      .rejects.toMatchObject({ response: { code: 'PAYMENT_AMOUNT_MISMATCH' } });
  });

  it('applies signed webhook exactly once and records payment on the order', async () => {
    const event = { paymentId, transactionCode: 'bank-tx-1', amount: 25000, status: 'SUCCESS' as const };
    const raw = Buffer.from(JSON.stringify(event));
    const signature = sign(raw);

    const payment = await service.handleWebhook('bank', event, raw, signature);
    const duplicate = await service.handleWebhook('bank', event, raw, signature);
    const order = await orderModel.findById(orderId).lean().exec();

    expect(payment.paymentStatus).toBe('SUCCESS');
    expect(duplicate.transactionCode).toBe('bank-tx-1');
    expect(order).toMatchObject({ paidAmount: 25000, amountDue: 0, paymentStatus: 'SUCCESS' });
    expect(order?.reservationExpiresAt).toBeUndefined();
  });

  it('rejects reuse of a transaction code for another payment payload', async () => {
    const event = { paymentId, transactionCode: 'bank-tx-1', amount: 25000, status: 'FAILED' as const };
    const raw = Buffer.from(JSON.stringify(event));
    await service.handleWebhook('bank', event, raw, sign(raw));
    const conflicting = { ...event, paymentId: '000000000000000000000001' };
    const conflictingRaw = Buffer.from(JSON.stringify(conflicting));
    await expect(service.handleWebhook('bank', conflicting, conflictingRaw, sign(conflictingRaw)))
      .rejects.toMatchObject({ response: { code: 'PAYMENT_TRANSACTION_CONFLICT' } });
  });

  it('rejects STAFF access to orders belonging to another store', async () => {
    const staff: AuthUser = { userId: 'staff-1', role: Role.STAFF, storeId: 'store-2' };
    await expect(service.getOne(staff, paymentId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a refund record and updates the amount due', async () => {
    await paymentModel.updateOne(
      { _id: paymentId },
      { $set: { paymentStatus: 'SUCCESS', transactionCode: 'paid-1', paidAt: new Date() } },
    ).exec();
    await orderModel.updateOne(
      { _id: orderId },
      { $set: { paymentStatus: 'SUCCESS', paidAmount: 25000, amountDue: 0 } },
    ).exec();

    const refund = await service.refund(
      { userId: 'admin-1', role: Role.ADMIN },
      paymentId,
      { amount: 5000, reason: 'Khách yêu cầu hoàn một phần' },
    );
    const order = await orderModel.findById(orderId).lean().exec();

    expect(refund).toMatchObject({ paymentStatus: 'REFUNDED', amount: 5000, relatedPaymentId: paymentId });
    expect(order).toMatchObject({ paidAmount: 20000, amountDue: 5000, paymentStatus: 'PENDING' });
    await expect(service.refund(
      { userId: 'admin-1', role: Role.ADMIN },
      paymentId,
      { amount: 20001, reason: 'Yêu cầu vượt số đã thanh toán' },
    )).rejects.toMatchObject({ response: { code: 'PAYMENT_REFUND_AMOUNT_INVALID' } });
  });
});

function sign(rawBody: Buffer): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}
