import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, HydratedDocument, Model, Types } from 'mongoose';
import { ErrorCode } from '../../common/constants/error-codes';
import {
  calculateEarnedPoints,
  calculateShippingFee,
  getBusinessRules,
} from '../../common/constants/business-rules';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/constants/roles';
import { Cart } from '../carts/schemas/cart.schema';
import { CartItem } from '../cart-items/schemas/cart-item.schema';
import { Customer } from '../customers/schemas/customer.schema';
import { Delivery } from '../deliveries/schemas/delivery.schema';
import { Employee } from '../employees/schemas/employee.schema';
import { Inventory } from '../inventory/schemas/inventory.schema';
import { InventoryRequest, InventoryService } from '../inventory/inventory.service';
import { Membership } from '../memberships/schemas/membership.schema';
import { MembershipLevel } from '../membership-levels/schemas/membership-level.schema';
import { OrderItem } from '../order-items/schemas/order-item.schema';
import { Order, OrderStatus, PaymentMethod, ReceiveMethod, parsePickupTime } from './schemas/order.schema';
import { OrdersService } from './orders.service';
import { Payment } from '../payments/schemas/payment.schema';
import { PointTransaction } from '../point-transactions/schemas/point-transaction.schema';
import { Product } from '../products/schemas/product.schema';
import { matchesDeliveryZone } from '../../common/utils/delivery-zone';
import { Store } from '../stores/schemas/store.schema';
import { User } from '../users/schemas/user.schema';
import { Voucher } from '../vouchers/schemas/voucher.schema';
import { VouchersService } from '../vouchers/vouchers.service';
import {
  CancelOrderDto,
  CreateOrderDto,
  OrderListQueryDto,
  OrderPreviewDto,
  ReturnOrderDto,
  ShippingInfoDto,
  UpdateOrderStatusDto,
  UpdateWeightDto,
} from './dto/order.dto';

interface PreparedOrder {
  customer: Customer;
  store: Store;
  cart: Cart;
  cartItems: CartItem[];
  products: Product[];
  subtotal: number;
  discountAmount: number;
  voucher?: Voucher;
  shippingFee: number;
  totalAmount: number;
  hasWeightedItems: boolean;
}

@Injectable()
export class OrdersApiService {
  private readonly logger = new Logger(OrdersApiService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(OrderItem.name) private readonly orderItems: Model<OrderItem>,
    @InjectModel(Cart.name) private readonly carts: Model<Cart>,
    @InjectModel(CartItem.name) private readonly cartItems: Model<CartItem>,
    @InjectModel(Customer.name) private readonly customers: Model<Customer>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(Store.name) private readonly stores: Model<Store>,
      @InjectModel(Voucher.name) private readonly voucherRecords: Model<Voucher>,
    @InjectModel(Payment.name) private readonly payments: Model<Payment>,
    @InjectModel(Membership.name) private readonly memberships: Model<Membership>,
    @InjectModel(MembershipLevel.name) private readonly membershipLevels: Model<MembershipLevel>,
    @InjectModel(PointTransaction.name) private readonly pointTransactions: Model<PointTransaction>,
    @InjectModel(Employee.name) private readonly employees: Model<Employee>,
    @InjectModel(Inventory.name) private readonly inventory: Model<Inventory>,
    @InjectModel(Delivery.name) private readonly deliveries: Model<Delivery>,
    private readonly orderWriter: OrdersService,
    private readonly inventoryService: InventoryService,
    private readonly vouchers: VouchersService,
    private readonly config: ConfigService,
  ) {}

  async preview(user: AuthUser, dto: OrderPreviewDto) {
    const prepared = await this.prepare(user.userId, dto);
    const freeShipRemaining = dto.receiveMethod === 'DELIVERY'
      ? Math.max(0, getBusinessRules(this.config).freeShipThreshold - prepared.subtotal)
      : 0;
    return {
      subtotal: prepared.subtotal,
      discountAmount: prepared.discountAmount,
      shippingFee: prepared.shippingFee,
      totalAmount: prepared.totalAmount,
      estimatedPoints: calculateEarnedPoints(prepared.totalAmount, prepared.shippingFee),
      hasWeightedItems: prepared.hasWeightedItems,
      freeShipRemaining,
    };
  }

  async create(user: AuthUser, dto: CreateOrderDto, idempotencyKey: string) {
    const customer = await this.getCustomer(user.userId);
    const existing = await this.orders.findOne({ customerId: customer.customerId, idempotencyKey }).exec();
    if (existing) return existing;

    const prepared = await this.prepare(user.userId, dto);
    const account = await this.users.findOne({ userId: user.userId }).select('fullName phone').exec();
    const address = prepared.customer.addresses?.find((item) => item.isDefault) ?? prepared.customer.addresses?.[0];
    const recipientName = dto.recipientName?.trim() || address?.recipientName || account?.fullName || 'Khách hàng';
    const recipientPhone = dto.recipientPhone?.trim() || address?.phone || account?.phone || '';
    if (!recipientPhone) throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Vui lòng cung cấp số điện thoại người nhận' });

    const paymentMethod: PaymentMethod = dto.paymentMethod ?? 'CASH';
    const orderItems = prepared.cartItems.map((item) => {
      const product = prepared.products.find((candidate) => candidate.productId === item.productId);
      if (!product) throw new NotFoundException({ code: ErrorCode.PRODUCT_NOT_FOUND, message: 'Không tìm thấy sản phẩm trong giỏ' });
      const unitPrice = getCurrentPrice(product);
      return {
        productId: product.productId,
        productName: product.productName,
        image: product.image,
        unit: product.unit,
        unitPrice,
        quantity: item.quantity,
        lineTotal: unitPrice * item.quantity,
      };
    });
    const reservation: InventoryRequest[] = prepared.cartItems.map((item) => ({
      storeId: prepared.store.storeId,
      productId: item.productId,
      quantity: item.quantity,
    }));

    try {
      return await this.orderWriter.createWithReservation({
        order: {
          customerId: prepared.customer.customerId,
          storeId: prepared.store.storeId,
          receiveMethod: dto.receiveMethod,
          orderStatus: 'PENDING',
          shippingAddress: dto.receiveMethod === 'DELIVERY' ? dto.shippingAddress : undefined,
          recipientName,
          recipientPhone,
          ...(dto.pickupTime ? parsePickupTime(dto.pickupTime) : {}),
          note: dto.note ?? dto.pickupNote,
          subtotal: prepared.subtotal,
          discountAmount: prepared.discountAmount,
          initialDiscountAmount: prepared.discountAmount,
          shippingFee: prepared.shippingFee,
          totalAmount: prepared.totalAmount,
          paidAmount: 0,
          amountDue: prepared.totalAmount,
          voucherCode: prepared.voucher?.code,
          paymentMethod,
          paymentStatus: 'PENDING',
          idempotencyKey,
        },
        items: orderItems,
        reservation,
        afterCreate: async (created, session) => {
          if (prepared.voucher) await this.vouchers.reserveUse(prepared.voucher.voucherId, prepared.subtotal, session);
          await this.cartItems.deleteMany({ cartId: prepared.cart.cartId }, { session }).exec();
          await this.carts.updateOne(
            { cartId: prepared.cart.cartId },
            { $set: { storeId: null, totalAmount: 0 } },
            { session },
          ).exec();
          if (paymentMethod === 'CASH') {
            await this.payments.create([{
              orderId: String(created._id),
              paymentMethod: 'CASH',
              paymentStatus: 'PENDING',
              amount: prepared.totalAmount,
            }], { session });
          }
        },
      });
    } catch (error) {
      if (isDuplicateKey(error)) {
        const order = await this.orders.findOne({ customerId: prepared.customer.customerId, idempotencyKey }).exec();
        if (order) return order;
      }
      throw error;
    }
  }

  async mine(user: AuthUser, query: OrderListQueryDto) {
    const customer = await this.getCustomer(user.userId);
    const filter: Record<string, unknown> = { customerId: customer.customerId };
    if (query.orderStatus) filter.orderStatus = query.orderStatus;
    const page = query.page;
    const limit = Math.min(50, query.limit);
    const [orders, total] = await Promise.all([
      this.orders.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.orders.countDocuments(filter).exec(),
    ]);
    const summaries = await Promise.all(orders.map(async (order) => {
      const items = await this.orderItems.find({ orderId: String(order._id) }).limit(2).exec();
      const itemCount = await this.orderItems.countDocuments({ orderId: String(order._id) }).exec();
      return { ...order.toJSON(), items: items.map(mapOrderItem), itemCount };
    }));
    return { data: summaries, meta: { page, limit, total } };
  }

  async list(user: AuthUser, query: OrderListQueryDto) {
    const filter: Record<string, unknown> = {};
    if (user.role === Role.STAFF) {
      if (!user.storeId) throw new NotFoundException({ code: ErrorCode.ORDER_NOT_FOUND, message: 'Không tìm thấy đơn hàng' });
      filter.storeId = user.storeId;
    } else if (query.storeId) filter.storeId = query.storeId;
    if (query.orderStatus) filter.orderStatus = query.orderStatus;
    if (query.receiveMethod) filter.receiveMethod = query.receiveMethod;
    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }
    const page = query.page;
    const limit = Math.min(50, query.limit);
    const [orders, total] = await Promise.all([
      this.orders.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.orders.countDocuments(filter).exec(),
    ]);
    return { data: orders, meta: { page, limit, total } };
  }

  async getOne(user: AuthUser, id: string) {
    const order = await this.findOrder(id);
    await this.assertAccess(user, order);
    const [items, payments, delivery] = await Promise.all([
      this.orderItems.find({ orderId: String(order._id) }).exec(),
      this.payments.find({ orderId: String(order._id) }).sort({ createdAt: -1 }).exec(),
      this.deliveries.findOne({ orderId: String(order._id) }).exec(),
    ]);
    return {
      ...order.toJSON(),
      items: items.map(mapOrderItem),
      payments: payments.map((payment) => payment.toJSON()),
      delivery: delivery?.toJSON() ?? null,
      amountDue: Math.max(0, order.totalAmount - order.paidAmount),
    };
  }

  async tracking(user: AuthUser, id: string) {
    const order = await this.findOrder(id);
    await this.assertAccess(user, order);
    const delivery = await this.deliveries.findOne({ orderId: String(order._id) }).exec();
    if (delivery) {
      return {
        carrierName: delivery.carrierName,
        trackingCode: delivery.trackingCode,
        status: delivery.deliveryStatus,
        events: delivery.events.map((event) => ({ time: event.time.toISOString(), status: event.status, location: event.location })),
      };
    }
    return {
      events: order.statusHistory.map((entry) => ({ time: entry.at.toISOString(), status: entry.status, location: '' })),
    };
  }

  async updateShippingInfo(user: AuthUser, id: string, dto: ShippingInfoDto) {
    const order = await this.findOrder(id);
    await this.assertAccess(user, order);
    if (order.orderStatus !== 'PENDING') {
      throw new ConflictException({ code: ErrorCode.ORDER_NOT_CANCELLABLE, message: 'Chỉ được sửa thông tin đơn khi đơn đang chờ xử lý' });
    }
    if (order.receiveMethod !== 'DELIVERY' && dto.shippingAddress) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Đơn nhận tại cửa hàng không có địa chỉ giao hàng' });
    }
    Object.assign(order, dto, dto.pickupTime ? parsePickupTime(dto.pickupTime) : {});
    await order.save();
    return order;
  }

  async cancel(user: AuthUser, id: string, dto: CancelOrderDto) {
    const order = await this.findOrder(id);
    await this.assertAccess(user, order);
    if (order.orderStatus !== 'PENDING') {
      throw new ConflictException({ code: ErrorCode.ORDER_NOT_CANCELLABLE, message: 'Chỉ được hủy đơn hàng đang chờ xử lý' });
    }
    const session = await this.connection.startSession();
    try {
      await this.runTransaction(session, async () => {
        const changed = await this.orders.findOneAndUpdate(
          { _id: order._id, orderStatus: 'PENDING' },
          { $set: { orderStatus: 'CANCELLED', cancelReason: dto.reason }, $unset: { reservationExpiresAt: 1 } },
          { new: true, session },
        ).exec();
        if (!changed) throw new ConflictException({ code: ErrorCode.ORDER_NOT_CANCELLABLE, message: 'Đơn hàng đã thay đổi trạng thái' });
        const items = await this.orderItems.find({ orderId: String(order._id) }).select('productId quantity').session(session).lean().exec();
        await this.inventoryService.release(items.map((item) => ({ storeId: order.storeId, productId: item.productId, quantity: item.quantity })), session);
        if (order.voucherCode) await this.vouchers.releaseUse(order.voucherCode, session);
        if (order.paidAmount > 0) {
          await this.payments.updateMany(
            { orderId: String(order._id), paymentStatus: 'SUCCESS' },
            { $set: { paymentStatus: 'REFUNDED', note: `Hoàn tiền do hủy đơn: ${dto.reason}` } },
            { session },
          ).exec();
          changed.paidAmount = 0;
          changed.amountDue = changed.totalAmount;
          changed.paymentStatus = 'REFUNDED';
          await changed.save({ session });
        } else {
          await this.payments.updateMany(
            { orderId: String(order._id), paymentStatus: 'PENDING' },
            { $set: { paymentStatus: 'FAILED', note: `Đơn hàng đã hủy: ${dto.reason}` } },
            { session },
          ).exec();
          changed.paymentStatus = 'FAILED';
          await changed.save({ session });
        }
      });
    } finally {
      await session.endSession();
    }
    return this.findOrder(id);
  }

  async requestReturn(user: AuthUser, id: string, dto: ReturnOrderDto) {
    const order = await this.findOrder(id);
    await this.assertAccess(user, order);
    if (order.orderStatus !== 'DELIVERED') {
      throw new ConflictException({ code: ErrorCode.ORDER_NOT_RETURNABLE, message: 'Chỉ được yêu cầu trả đơn đã giao' });
    }
    order.orderStatus = 'RETURNING';
    order.returnReason = dto.reason;
    order.returnDescription = dto.description;
    await order.save();
    return order;
  }

  async accept(user: AuthUser, id: string) {
    const order = await this.findOrder(id);
    await this.assertStaffStore(user, order);
    return this.changeStatus(user, id, { orderStatus: 'PREPARING' });
  }

  async updateWeight(user: AuthUser, id: string, itemId: string, dto: UpdateWeightDto) {
    const order = await this.findOrder(id);
    await this.assertStaffStore(user, order);
    if (!['PENDING', 'PREPARING'].includes(order.orderStatus)) {
      throw new ConflictException({ code: ErrorCode.INVALID_STATUS_TRANSITION, message: 'Không thể cập nhật khối lượng ở trạng thái đơn hiện tại' });
    }
    const item = await this.orderItems.findOne({ _id: itemId, orderId: String(order._id) }).exec();
    if (!item) throw new NotFoundException({ code: ErrorCode.ORDER_NOT_FOUND, message: 'Không tìm thấy sản phẩm trong đơn hàng' });
    if (!isWeighted(item.unit)) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Sản phẩm này không bán theo cân' });
    }
    if (dto.actualWeight > item.quantity * getBusinessRules(this.config).maxWeightMultiplier) {
      throw new ConflictException({ code: ErrorCode.WEIGHT_EXCEEDS_LIMIT, message: 'Khối lượng vượt quá 120% ước tính; vui lòng liên hệ khách hàng' });
    }
    item.actualWeight = dto.actualWeight;
    item.lineTotal = item.unitPrice * dto.actualWeight;
    await item.save();

    const items = await this.orderItems.find({ orderId: String(order._id) }).exec();
    const subtotal = items.reduce((total, entry) => total + (entry.actualWeight === undefined ? entry.lineTotal : entry.unitPrice * entry.actualWeight), 0);
    let discountAmount = order.initialDiscountAmount;
    if (order.voucherCode) {
      const voucher = await this.voucherRecords.findOne({ code: order.voucherCode }).select('discountValue minOrderAmount').exec();
      if (voucher && subtotal >= voucher.minOrderAmount) discountAmount = Math.min(voucher.discountValue, subtotal);
    }
    discountAmount = Math.min(discountAmount, subtotal);
    order.subtotal = subtotal;
    order.discountAmount = discountAmount;
    order.totalAmount = Math.max(0, subtotal - discountAmount) + order.shippingFee;
    const unpaidAmount = order.totalAmount - order.paidAmount;
    order.amountDue = Math.max(0, unpaidAmount);
    await order.save();

    const weightedItemsComplete = items.every((entry) => !isWeighted(entry.unit) || entry.actualWeight !== undefined);
    if (weightedItemsComplete && unpaidAmount < 0 && order.paymentMethod !== 'CASH') {
      const refundToIssue = Math.max(0, order.paidAmount - order.totalAmount);
      if (refundToIssue > 0) {
        await this.payments.create({
          orderId: String(order._id),
          paymentMethod: order.paymentMethod ?? 'TRANSFER',
          paymentStatus: 'REFUNDED',
          amount: refundToIssue,
          note: 'Hoàn phần chênh lệch do cập nhật khối lượng thực tế',
        });
        order.paidAmount = order.totalAmount;
        order.amountDue = 0;
        await order.save();
      }
    } else if (weightedItemsComplete && order.amountDue > 0) {
      const paymentMethod = order.paymentMethod ?? 'CASH';
      const pendingPayment = await this.payments.findOne({
        orderId: String(order._id),
        paymentMethod,
        paymentStatus: 'PENDING',
      }).exec();
      if (pendingPayment) {
        pendingPayment.amount = order.amountDue;
        await pendingPayment.save();
      } else {
        await this.payments.create({
          orderId: String(order._id),
          paymentMethod,
          paymentStatus: 'PENDING',
          amount: order.amountDue,
        });
      }
    }
    return { ...order.toJSON(), items: items.map(mapOrderItem), amountDue: order.amountDue };
  }

  async changeStatus(user: AuthUser, id: string, dto: UpdateOrderStatusDto) {
    const order = await this.findOrder(id);
    await this.assertStaffStore(user, order);
    const next = dto.orderStatus as OrderStatus;
    if (next === 'DELIVERED' && order.paymentMethod !== 'CASH' && order.amountDue > 0) {
      throw new ConflictException({ code: ErrorCode.PAYMENT_NOT_SETTLED, message: 'Đơn hàng cần được thanh toán đủ trước khi giao' });
    }
    const validNext = order.receiveMethod === 'DELIVERY'
      ? ({
        PENDING: ['PREPARING'],
        PREPARING: ['SHIPPING'],
        SHIPPING: ['DELIVERED'],
        RETURNING: ['RETURNED'],
      } as Partial<Record<OrderStatus, OrderStatus[]>>)
      : ({
        PENDING: ['PREPARING'],
        PREPARING: ['READY_FOR_PICKUP'],
        READY_FOR_PICKUP: ['DELIVERED'],
        RETURNING: ['RETURNED'],
      } as Partial<Record<OrderStatus, OrderStatus[]>>);
    if (!validNext[order.orderStatus]?.includes(next)) {
      throw new ConflictException({ code: ErrorCode.INVALID_STATUS_TRANSITION, message: 'Chuyển trạng thái đơn hàng không hợp lệ' });
    }
    const items = await this.orderItems.find({ orderId: String(order._id) }).exec();
    if (['SHIPPING', 'READY_FOR_PICKUP'].includes(next)
      && items.some((item) => isWeighted(item.unit) && item.actualWeight === undefined)) {
      throw new ConflictException({ code: ErrorCode.WEIGHT_REQUIRED, message: 'Cần nhập đủ khối lượng thực tế trước khi giao/chuẩn bị nhận hàng' });
    }

    const session = await this.connection.startSession();
    try {
      await this.runTransaction(session, async () => {
        if (next === 'PREPARING') {
          const reservation: InventoryRequest[] = items.map((item) => ({
            storeId: order.storeId,
            productId: item.productId,
            quantity: item.quantity,
          }));
          await this.inventoryService.commit(reservation, session);
        }
        const changed = await this.orders.findOneAndUpdate(
          { _id: order._id, orderStatus: order.orderStatus },
          { $set: { orderStatus: next } },
          { new: true, session },
        ).exec();
        if (!changed) throw new ConflictException({ code: ErrorCode.INVALID_STATUS_TRANSITION, message: 'Đơn hàng đã được cập nhật bởi nhân viên khác' });
        const employee = user.role === Role.STAFF ? await this.employees.findOne({ userId: user.userId }).select('employeeId').session(session).exec() : null;
        const statusEntry = changed.statusHistory[changed.statusHistory.length - 1];
        if (statusEntry) statusEntry.by = employee?.employeeId ?? user.userId;
        if (next === 'DELIVERED') {
          for (const item of items) {
            await this.products.updateOne({ productId: item.productId }, { $inc: { soldCount: item.actualWeight ?? item.quantity } }, { session }).exec();
          }
          await this.payments.updateMany(
            { orderId: String(order._id), paymentMethod: 'CASH', paymentStatus: 'PENDING' },
            { $set: { paymentStatus: 'SUCCESS', paidAt: new Date(), amount: Math.max(0, changed.amountDue) } },
            { session },
          ).exec();
          if (order.paymentMethod === 'CASH') {
            changed.paidAmount = changed.totalAmount;
            changed.amountDue = 0;
            changed.paymentStatus = 'SUCCESS';
          }
          await this.earnPoints(changed, session);
        }
        if (next === 'RETURNED') await this.adjustPoints(changed, session);
        await changed.save({ session });
      });
    } finally {
      await session.endSession();
    }
    return this.findOrder(id);
  }

  private async prepare(userId: string, dto: OrderPreviewDto): Promise<PreparedOrder> {
    const customer = await this.getCustomer(userId);
    const store = await this.stores.findOne({ storeId: dto.storeId }).exec();
    if (!store || store.status !== 'ACTIVE') {
      throw new ConflictException({ code: ErrorCode.STORE_UNAVAILABLE, message: 'Cửa hàng hiện không hoạt động' });
    }
    const cart = await this.carts.findOne({ customerId: customer.customerId }).exec();
    if (!cart || cart.storeId !== store.storeId) {
      throw new ConflictException({ code: ErrorCode.VALIDATION_ERROR, message: 'Giỏ hàng chưa có sản phẩm tại cửa hàng đã chọn' });
    }
    const cartItems = await this.cartItems.find({ cartId: cart.cartId }).exec();
    if (!cartItems.length) throw new ConflictException({ code: ErrorCode.VALIDATION_ERROR, message: 'Giỏ hàng đang trống' });
    if (dto.receiveMethod === 'DELIVERY') {
      if (!dto.shippingAddress?.trim()) {
        throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Vui lòng nhập địa chỉ giao hàng' });
      }
      if (!matchesDeliveryZone(dto.shippingAddress, store.deliveryZones)) {
        throw new ConflictException({ code: ErrorCode.OUT_OF_DELIVERY_ZONE, message: 'Địa chỉ nằm ngoài khu vực giao hàng của cửa hàng' });
      }
    }
    const products = await this.products.find({ productId: { $in: cartItems.map((item) => item.productId) } }).exec();
    if (products.length !== cartItems.length || products.some((product) => product.status !== 'ACTIVE')) {
      throw new NotFoundException({ code: ErrorCode.PRODUCT_NOT_FOUND, message: 'Một hoặc nhiều sản phẩm trong giỏ không còn bán' });
    }
    for (const item of cartItems) {
      const product = products.find((candidate) => candidate.productId === item.productId);
      if (!product) throw new NotFoundException({ code: ErrorCode.PRODUCT_NOT_FOUND, message: 'Không tìm thấy sản phẩm trong giỏ' });
      validateOrderQuantity(product.unit, item.quantity);
      const inventory = await this.inventory
        .findOne({ storeId: store.storeId, productId: product.productId })
        .select('quantity reservedQuantity').lean().exec();
      const available = inventory ? Math.max(0, inventory.quantity - (inventory.reservedQuantity ?? 0)) : 0;
      if (item.quantity > available) {
        throw new ConflictException({
          code: ErrorCode.OUT_OF_STOCK,
          message: 'Một hoặc nhiều sản phẩm không đủ tồn kho',
          missing: [{ storeId: store.storeId, productId: product.productId, quantity: item.quantity, available }],
        });
      }
    }
    const subtotal = cartItems.reduce((sum, item) => {
      const product = products.find((candidate) => candidate.productId === item.productId)!;
      return sum + getCurrentPrice(product) * item.quantity;
    }, 0);
    const voucherResult = dto.voucherCode ? await this.vouchers.validate(dto.voucherCode, subtotal) : undefined;
    const discountAmount = voucherResult?.discountAmount ?? 0;
    const rules = getBusinessRules(this.config);
    const shippingFee = calculateShippingFee(
      dto.receiveMethod,
      subtotal,
      store.shippingFee?.baseFee ?? rules.defaultShippingFee,
      rules.freeShipThreshold,
    );
    return {
      customer,
      store,
      cart,
      cartItems,
      products,
      subtotal,
      discountAmount,
      voucher: voucherResult?.voucher,
      shippingFee,
      totalAmount: Math.max(0, subtotal - discountAmount) + shippingFee,
      hasWeightedItems: products.some((product) => isWeighted(product.unit)),
    };
  }

  private async getCustomer(userId: string) {
    const customer = await this.customers.findOne({ userId }).exec();
    if (!customer) throw new NotFoundException({ code: ErrorCode.CUSTOMER_NOT_FOUND, message: 'Không tìm thấy hồ sơ khách hàng' });
    return customer;
  }

  private async findOrder(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException({ code: ErrorCode.ORDER_NOT_FOUND, message: 'Không tìm thấy đơn hàng' });
    const order = await this.orders.findById(id).exec();
    if (!order) throw new NotFoundException({ code: ErrorCode.ORDER_NOT_FOUND, message: 'Không tìm thấy đơn hàng' });
    return order;
  }

  private async assertAccess(user: AuthUser, order: Order): Promise<void> {
    if (user.role === Role.ADMIN) return;
    if (user.role === Role.STAFF) return this.assertStaffStore(user, order);
    const customer = await this.customers.findOne({ userId: user.userId }).select('customerId').exec();
    if (!customer || customer.customerId !== order.customerId) {
      throw new NotFoundException({ code: ErrorCode.ORDER_NOT_FOUND, message: 'Không tìm thấy đơn hàng' });
    }
  }

  private async assertStaffStore(user: AuthUser, order: Order): Promise<void> {
    if (user.role === Role.ADMIN) return;
    if (user.role !== Role.STAFF || !user.storeId || user.storeId !== order.storeId) {
      throw new NotFoundException({ code: ErrorCode.ORDER_NOT_FOUND, message: 'Không tìm thấy đơn hàng' });
    }
  }

  private async earnPoints(order: HydratedDocument<Order>, session: ClientSession): Promise<void> {
    const exists = await this.pointTransactions.exists({ orderId: String(order._id), type: 'EARN' }).session(session);
    if (exists) return;
    const customer = await this.customers.findOne({ customerId: order.customerId }).select('customerId').session(session).exec();
    if (!customer) throw new NotFoundException({ code: ErrorCode.CUSTOMER_NOT_FOUND, message: 'Không tìm thấy hồ sơ khách hàng' });
    const membership = await this.memberships.findOne({ customerId: order.customerId }).session(session).exec();
    if (!membership) return;
    const points = calculateEarnedPoints(order.totalAmount, order.shippingFee);
    if (points <= 0) return;
    membership.pointBalance += points;
    membership.lifetimePoints += points;
    const level = await this.membershipLevels.findOne({ minPoints: { $lte: membership.lifetimePoints } })
      .sort({ minPoints: -1 }).session(session).exec();
    if (level) membership.memberLevel = level.name;
    await membership.save({ session });
    await this.pointTransactions.create([{
      customerId: order.customerId,
      orderId: String(order._id),
      type: 'EARN',
      points,
      balanceAfter: membership.pointBalance,
      note: `Tích điểm đơn hàng ${order.orderCode}`,
    }], { session });
  }

  private async adjustPoints(order: HydratedDocument<Order>, session: ClientSession): Promise<void> {
    const earned = await this.pointTransactions.findOne({ orderId: String(order._id), type: 'EARN' }).session(session).exec();
    if (!earned) return;
    const adjusted = await this.pointTransactions.exists({ orderId: String(order._id), type: 'ADJUST' }).session(session);
    if (adjusted) return;
    const membership = await this.memberships.findOne({ customerId: order.customerId }).session(session).exec();
    if (!membership) return;
    const points = Math.abs(earned.points);
    membership.pointBalance = Math.max(0, membership.pointBalance - points);
    membership.lifetimePoints = Math.max(0, membership.lifetimePoints - points);
    const level = await this.membershipLevels.findOne({ minPoints: { $lte: membership.lifetimePoints } })
      .sort({ minPoints: -1 }).session(session).exec();
    if (level) membership.memberLevel = level.name;
    await membership.save({ session });
    await this.pointTransactions.create([{
      customerId: order.customerId,
      orderId: String(order._id),
      type: 'ADJUST',
      points: -points,
      balanceAfter: membership.pointBalance,
      note: `Điều chỉnh điểm do trả đơn hàng ${order.orderCode}`,
    }], { session });
  }

  private async runTransaction(session: ClientSession, action: () => Promise<void>): Promise<void> {
    try {
      await session.withTransaction(action);
    } catch (error) {
      if (!isTransactionUnsupported(error)) throw error;
      this.logger.warn('MongoDB không hỗ trợ transaction; chạy tuần tự');
      await action();
    }
  }
}

function isWeighted(unit: string): boolean {
  return unit.trim().toLowerCase() === 'kg';
}

function validateOrderQuantity(unit: string, quantity: number): void {
  const valid = isWeighted(unit)
    ? Number.isInteger(quantity * 2) && quantity >= 0.5
    : Number.isInteger(quantity) && quantity >= 1;
  if (!valid) throw new BadRequestException({ code: ErrorCode.INVALID_QUANTITY, message: 'Số lượng trong giỏ không hợp lệ' });
}

function getCurrentPrice(product: Product): number {
  const now = new Date();
  return typeof product.salePrice === 'number' && Boolean(product.saleStartDate && product.saleEndDate)
    && product.saleStartDate! <= now && product.saleEndDate! >= now
    ? product.salePrice
    : product.price;
}

function mapOrderItem(item: HydratedDocument<OrderItem>) {
  const value = item.toJSON() as Record<string, unknown>;
  return {
    ...value,
    itemId: String(value.orderItemId ?? value._id),
    price: item.unitPrice,
  };
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
