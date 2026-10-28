import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { createHmac, timingSafeEqual } from 'crypto';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { ErrorCode } from '../../common/constants/error-codes';
import { PAYMENT_RESERVATION_DURATION_MS } from '../../common/constants/business-rules';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/constants/roles';
import { Customer } from '../customers/schemas/customer.schema';
import { Order } from '../orders/schemas/order.schema';
import { Payment } from './schemas/payment.schema';
import { CreatePaymentDto, MockPaymentConfirmDto, PaymentWebhookDto, RefundPaymentDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Payment.name) private readonly payments: Model<Payment>,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(Customer.name) private readonly customers: Model<Customer>,
    private readonly config: ConfigService,
  ) {}

  async create(user: AuthUser, dto: CreatePaymentDto) {
    const order = await this.findOrder(dto.orderId);
    await this.assertAccess(user, order);
    if (dto.paymentMethod === 'CASH') {
      throw new BadRequestException({ code: ErrorCode.PAYMENT_METHOD_UNSUPPORTED, message: 'Thanh toán tiền mặt được thu khi nhận hàng, không tạo giao dịch trực tuyến' });
    }
    if (order.paymentMethod !== dto.paymentMethod) {
      throw new ConflictException({ code: ErrorCode.PAYMENT_METHOD_MISMATCH, message: 'Phương thức thanh toán không khớp với đơn hàng' });
    }
    if (order.orderStatus !== 'PENDING' || order.paymentStatus === 'SUCCESS') {
      throw new ConflictException({ code: ErrorCode.PAYMENT_ALREADY_SETTLED, message: 'Đơn hàng không còn chờ thanh toán' });
    }
    const amount = Math.max(0, order.amountDue ?? order.totalAmount - order.paidAmount);
    if (amount <= 0) {
      throw new ConflictException({ code: ErrorCode.PAYMENT_ALREADY_SETTLED, message: 'Đơn hàng đã được thanh toán đủ' });
    }
    const now = new Date();
    const expiresAt = order.reservationExpiresAt ?? new Date(now.getTime() + PAYMENT_RESERVATION_DURATION_MS);
    if (expiresAt <= now) {
      throw new ConflictException({ code: ErrorCode.PAYMENT_EXPIRED, message: 'Thời gian giữ tồn của đơn hàng đã hết hạn' });
    }
    if (dto.paymentMethod === 'TRANSFER') {
      const bankId = this.config.get<string>('payment.bankId');
      const accountNumber = this.config.get<string>('payment.accountNumber');
      const accountName = this.config.get<string>('payment.accountName');
      if (!bankId || !accountNumber || !accountName) {
        throw new ServiceUnavailableException({ code: ErrorCode.PAYMENT_CONFIGURATION_MISSING, message: 'Chưa cấu hình thông tin tài khoản nhận chuyển khoản' });
      }
    }
    if (dto.paymentMethod === 'CARD' && !this.config.get<string>('payment.cardCheckoutUrl')) {
      throw new ServiceUnavailableException({ code: ErrorCode.PAYMENT_CONFIGURATION_MISSING, message: 'Chưa cấu hình cổng thanh toán thẻ' });
    }
    const existing = await this.payments.findOne({
      orderId: String(order._id),
      paymentMethod: dto.paymentMethod,
      paymentStatus: 'PENDING',
    }).exec();
    let payment = existing;
    if (payment && payment.expiresAt && payment.expiresAt <= now) {
      payment.paymentStatus = 'FAILED';
      payment.note = 'Giao dịch hết hạn';
      await payment.save();
      payment = null;
    }
    if (!payment) {
      [payment] = await this.payments.create([{
        orderId: String(order._id),
        paymentMethod: dto.paymentMethod,
        paymentStatus: 'PENDING',
        provider: dto.paymentMethod.toLowerCase(),
        amount,
        transferContent: order.orderCode,
        expiresAt,
      }]);
    } else if (payment.amount !== amount) {
      payment.amount = amount;
      payment.expiresAt = expiresAt;
      await payment.save();
    }

    if (dto.paymentMethod === 'TRANSFER') {
      const bankId = this.config.get<string>('payment.bankId')!;
      const accountNumber = this.config.get<string>('payment.accountNumber')!;
      const accountName = this.config.get<string>('payment.accountName')!;
      const bankName = this.config.get<string>('payment.bankName') ?? bankId;
      const qrCodeUrl = new URL(
        `https://img.vietqr.io/image/${encodeURIComponent(bankId)}-${encodeURIComponent(accountNumber)}-compact2.png`,
      );
      qrCodeUrl.searchParams.set('amount', String(amount));
      qrCodeUrl.searchParams.set('addInfo', order.orderCode);
      qrCodeUrl.searchParams.set('accountName', accountName);
      return {
        paymentId: String(payment._id),
        paymentMethod: payment.paymentMethod,
        amount,
        transferContent: order.orderCode,
        expiresAt: payment.expiresAt,
        bankName,
        accountNumber,
        accountName,
        qrCodeUrl: qrCodeUrl.toString(),
      };
    }

    const checkoutBaseUrl = this.config.get<string>('payment.cardCheckoutUrl')!;
    const checkoutUrl = new URL(checkoutBaseUrl);
    checkoutUrl.searchParams.set('paymentId', String(payment._id));
    checkoutUrl.searchParams.set('orderCode', order.orderCode);
    checkoutUrl.searchParams.set('amount', String(amount));
    return {
      paymentId: String(payment._id),
      paymentMethod: payment.paymentMethod,
      amount,
      paymentUrl: checkoutUrl.toString(),
      expiresAt: payment.expiresAt,
    };
  }

  async getOne(user: AuthUser, id: string) {
    const payment = await this.findPayment(id);
    const order = await this.findOrder(payment.orderId);
    await this.assertAccess(user, order);
    return payment;
  }

  async findForOrder(user: AuthUser, orderId: string) {
    const order = await this.findOrder(orderId);
    await this.assertAccess(user, order);
    return this.payments.find({ orderId: String(order._id) }).sort({ createdAt: -1 }).exec();
  }

  async handleWebhook(provider: string, dto: PaymentWebhookDto, rawBody: Buffer, signature?: string) {
    this.verifySignature(rawBody, signature);
    if (!/^[a-z0-9_-]{1,40}$/i.test(provider)) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Nhà cung cấp thanh toán không hợp lệ' });
    }
    return this.applyWebhook(provider.toLowerCase(), dto);
  }

  async mockConfirm(paymentId: string, dto: MockPaymentConfirmDto) {
    if (this.config.get<string>('nodeEnv') === 'production') {
      throw new NotFoundException({ code: ErrorCode.PAYMENT_NOT_FOUND, message: 'Không tìm thấy giao dịch' });
    }
    const payment = await this.findPayment(paymentId);
    return this.applyWebhook('mock', {
      paymentId,
      transactionCode: dto.transactionCode?.trim() || `mock-${paymentId}`,
      amount: payment.amount,
      status: dto.status,
    });
  }

  async refund(user: AuthUser, id: string, dto: RefundPaymentDto) {
    if (!dto.reason.trim()) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Lý do hoàn tiền không được để trống' });
    }
    const payment = await this.findPayment(id);
    const order = await this.findOrder(payment.orderId);
    await this.assertStaffAccess(user, order);
    if (payment.paymentStatus !== 'SUCCESS') {
      throw new ConflictException({ code: ErrorCode.PAYMENT_NOT_REFUNDABLE, message: 'Chỉ có thể hoàn giao dịch đã thanh toán thành công' });
    }
    const session = await this.connection.startSession();
    let refund: Payment | undefined;
    try {
      await this.runTransaction(session, async (activeSession) => {
        const [freshPayment, freshOrder, [alreadyRefunded]] = await Promise.all([
          this.payments.findById(payment._id).session(activeSession).exec(),
          this.orders.findById(order._id).session(activeSession).exec(),
          this.payments.aggregate<{ total: number }>([
            { $match: { relatedPaymentId: String(payment._id), paymentStatus: 'REFUNDED' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ]).session(activeSession).exec(),
        ]);
        if (!freshPayment || freshPayment.paymentStatus !== 'SUCCESS' || !freshOrder) {
          throw new ConflictException({ code: ErrorCode.PAYMENT_NOT_REFUNDABLE, message: 'Giao dịch đã thay đổi, không thể hoàn tiền' });
        }
        const refundable = Math.min(freshPayment.amount, freshOrder.paidAmount) - (alreadyRefunded?.total ?? 0);
        const amount = dto.amount ?? refundable;
        if (amount <= 0 || amount > refundable) {
          throw new BadRequestException({ code: ErrorCode.PAYMENT_REFUND_AMOUNT_INVALID, message: 'Số tiền hoàn vượt quá số tiền có thể hoàn' });
        }
        const newPaidAmount = freshOrder.paidAmount - amount;
        const amountDue = Math.max(0, freshOrder.totalAmount - newPaidAmount);
        const updatedOrder = await this.orders.findOneAndUpdate(
          { _id: freshOrder._id, paidAmount: freshOrder.paidAmount },
          {
            $set: {
              paidAmount: newPaidAmount,
              amountDue,
              paymentStatus: amountDue === 0 ? 'SUCCESS' : 'PENDING',
            },
          },
          { new: true, session: activeSession },
        ).exec();
        if (!updatedOrder) {
          throw new ConflictException({ code: ErrorCode.PAYMENT_REFUND_AMOUNT_INVALID, message: 'Số tiền đã thanh toán thay đổi, vui lòng thử lại' });
        }
        const [created] = await this.payments.create([{
          orderId: String(order._id),
          paymentMethod: payment.paymentMethod,
          paymentStatus: 'REFUNDED',
          provider: payment.provider,
          amount,
          relatedPaymentId: String(payment._id),
          note: dto.reason.trim(),
          paidAt: new Date(),
        }], { session: activeSession });
        refund = created;
      });
    } finally {
      await session.endSession();
    }
    if (!refund) throw new Error('Hoàn tiền kết thúc nhưng không tạo được giao dịch hoàn');
    return refund;
  }

  private async applyWebhook(provider: string, dto: PaymentWebhookDto) {
    const transactionCode = dto.transactionCode.trim();
    if (!transactionCode) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Mã giao dịch không được để trống' });
    }
    const existingTransaction = await this.payments.findOne({ transactionCode }).exec();
    if (existingTransaction) {
      if (
        String(existingTransaction._id) === dto.paymentId
        && existingTransaction.amount === dto.amount
        && existingTransaction.paymentStatus === dto.status
      ) return existingTransaction;
      throw new ConflictException({ code: ErrorCode.PAYMENT_TRANSACTION_CONFLICT, message: 'Mã giao dịch đã được sử dụng' });
    }

    const payment = await this.findPayment(dto.paymentId);
    if (payment.paymentStatus !== 'PENDING') {
      throw new ConflictException({ code: ErrorCode.PAYMENT_ALREADY_SETTLED, message: 'Giao dịch không còn chờ xử lý' });
    }
    if (payment.amount !== dto.amount) {
      throw new BadRequestException({ code: ErrorCode.PAYMENT_AMOUNT_MISMATCH, message: 'Số tiền webhook không khớp với giao dịch' });
    }
    const order = await this.findOrder(payment.orderId);
    if (order.orderStatus === 'CANCELLED' || order.orderStatus === 'RETURNED') {
      throw new ConflictException({ code: ErrorCode.PAYMENT_ALREADY_SETTLED, message: 'Đơn hàng đã kết thúc, không thể ghi nhận thanh toán' });
    }
    const session = await this.connection.startSession();
    let result: Payment | undefined;
    try {
      await this.runTransaction(session, async (activeSession) => {
        const updatedPayment = await this.payments.findOneAndUpdate(
          { _id: payment._id, paymentStatus: 'PENDING' },
          {
            $set: {
              paymentStatus: dto.status,
              provider,
              transactionCode,
              webhookReceivedAt: new Date(),
              ...(dto.status === 'SUCCESS' ? { paidAt: new Date() } : {}),
            },
          },
          { new: true, session: activeSession, runValidators: true },
        ).exec();
        if (!updatedPayment) {
          throw new ConflictException({ code: ErrorCode.PAYMENT_ALREADY_SETTLED, message: 'Giao dịch đã được xử lý bởi một webhook khác' });
        }
        const orderUpdate = dto.status === 'SUCCESS'
          ? {
            $inc: { paidAmount: payment.amount },
            $set: {
              paymentStatus: payment.amount >= (order.amountDue ?? order.totalAmount - order.paidAmount) ? 'SUCCESS' : 'PENDING',
              amountDue: Math.max(0, order.totalAmount - order.paidAmount - payment.amount),
            },
            $unset: { reservationExpiresAt: 1 },
          }
          : { $set: { paymentStatus: 'FAILED' } };
        const updatedOrder = await this.orders.findOneAndUpdate(
          {
            _id: order._id,
            orderStatus: { $nin: ['CANCELLED', 'RETURNED'] },
            paidAmount: order.paidAmount,
          },
          orderUpdate,
          { new: true, session: activeSession },
        ).exec();
        if (!updatedOrder) {
          throw new ConflictException({ code: ErrorCode.PAYMENT_ALREADY_SETTLED, message: 'Trạng thái đơn hàng đã thay đổi khi xử lý thanh toán' });
        }
        result = updatedPayment;
      });
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new ConflictException({ code: ErrorCode.PAYMENT_TRANSACTION_CONFLICT, message: 'Mã giao dịch đã được sử dụng' });
      }
      throw error;
    } finally {
      await session.endSession();
    }
    if (!result) throw new Error('Webhook thanh toán kết thúc nhưng không cập nhật được giao dịch');
    return result;
  }

  private verifySignature(rawBody: Buffer, signature?: string): void {
    const secret = this.config.get<string>('payment.webhookSecret');
    if (!secret) {
      throw new ServiceUnavailableException({ code: ErrorCode.PAYMENT_CONFIGURATION_MISSING, message: 'Chưa cấu hình khóa xác thực webhook thanh toán' });
    }
    const supplied = signature?.replace(/^sha256=/i, '').trim();
    if (!supplied || !/^[a-f0-9]{64}$/i.test(supplied)) {
      throw new BadRequestException({ code: ErrorCode.PAYMENT_SIGNATURE_INVALID, message: 'Chữ ký webhook không hợp lệ' });
    }
    const expected = createHmac('sha256', secret).update(rawBody).digest();
    const actual = Buffer.from(supplied, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new BadRequestException({ code: ErrorCode.PAYMENT_SIGNATURE_INVALID, message: 'Chữ ký webhook không hợp lệ' });
    }
  }

  private async findOrder(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException({ code: ErrorCode.ORDER_NOT_FOUND, message: 'Không tìm thấy đơn hàng' });
    }
    const order = await this.orders.findById(id).exec();
    if (!order) throw new NotFoundException({ code: ErrorCode.ORDER_NOT_FOUND, message: 'Không tìm thấy đơn hàng' });
    return order;
  }

  private async findPayment(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException({ code: ErrorCode.PAYMENT_NOT_FOUND, message: 'Không tìm thấy giao dịch' });
    }
    const payment = await this.payments.findById(id).exec();
    if (!payment) throw new NotFoundException({ code: ErrorCode.PAYMENT_NOT_FOUND, message: 'Không tìm thấy giao dịch' });
    return payment;
  }

  private async assertAccess(user: AuthUser, order: Order): Promise<void> {
    if (user.role === Role.ADMIN) return;
    if (user.role === Role.STAFF) return this.assertStaffAccess(user, order);
    const customer = await this.customers.findOne({ userId: user.userId }).select('customerId').exec();
    if (user.role !== Role.CUSTOMER || !customer || customer.customerId !== order.customerId) {
      throw new NotFoundException({ code: ErrorCode.PAYMENT_NOT_FOUND, message: 'Không tìm thấy giao dịch' });
    }
  }

  private assertStaffAccess(user: AuthUser, order: Order): void {
    if (user.role === Role.ADMIN) return;
    if (user.role !== Role.STAFF || !user.storeId || user.storeId !== order.storeId) {
      throw new NotFoundException({ code: ErrorCode.PAYMENT_NOT_FOUND, message: 'Không tìm thấy giao dịch' });
    }
  }

  private async runTransaction(session: ClientSession, action: (session: ClientSession) => Promise<void>): Promise<void> {
    try {
      await session.withTransaction(() => action(session));
    } catch (error) {
      if (!isTransactionUnsupported(error)) throw error;
      await action(session);
    }
  }
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

function isTransactionUnsupported(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: number; message?: string; codeName?: string };
  return candidate.code === 20
    || candidate.codeName === 'IllegalOperation'
    || candidate.message?.includes('Transaction numbers are only allowed') === true
    || candidate.message?.includes('replica set member or mongos') === true;
}
