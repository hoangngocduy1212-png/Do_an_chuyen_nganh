import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, HydratedDocument, Model } from 'mongoose';
import { InventoryRequest, InventoryService } from '../inventory/inventory.service';
import { Counter, nextOrderCode } from '../counters/schemas/counter.schema';
import { Order } from './schemas/order.schema';
import { OrderItem } from '../order-items/schemas/order-item.schema';
import { PAYMENT_RESERVATION_DURATION_MS } from '../../common/constants/business-rules';

export interface NewOrderItem {
  productId: string;
  productName: string;
  image: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  actualWeight?: number;
  lineTotal: number;
}

export interface NewReservedOrder {
  order: Omit<Order, 'orderCode' | 'statusHistory'>;
  items: NewOrderItem[];
  reservation: InventoryRequest[];
  afterCreate?: (order: HydratedDocument<Order>, session: ClientSession) => Promise<void>;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(OrderItem.name) private readonly orderItemModel: Model<OrderItem>,
    @InjectModel(Counter.name) private readonly counterModel: Model<Counter>,
    private readonly inventory: InventoryService,
  ) {}

  async createWithReservation(input: NewReservedOrder): Promise<HydratedDocument<Order>> {
    const session = await this.connection.startSession();
    try {
      try {
        let created: HydratedDocument<Order> | undefined;
        await session.withTransaction(async () => {
          await this.inventory.reserve(input.reservation, session);
          created = await this.persistOrder(input, session);
          await input.afterCreate?.(created, session);
        });
        if (!created) throw new Error('Transaction đặt hàng kết thúc nhưng không tạo được đơn hàng');
        return created;
      } catch (error) {
        if (!this.isTransactionUnsupported(error)) throw error;
        this.logger.warn('MongoDB không hỗ trợ transaction; giữ tồn theo tuần tự và hoàn tác nếu lỗi');
      }

      return await this.createSequentially(input, session);
    } finally {
      await session.endSession();
    }
  }

  private async createSequentially(input: NewReservedOrder, session: ClientSession): Promise<HydratedDocument<Order>> {
    await this.inventory.reserve(input.reservation, session);
    let order: HydratedDocument<Order> | undefined;
    try {
      order = await this.persistOrder(input, session);
      await input.afterCreate?.(order, session);
      return order;
    } catch (error) {
      if (order) {
        await this.orderItemModel.deleteMany({ orderId: order._id.toString() }, { session }).exec();
        await this.orderModel.deleteOne({ _id: order._id }, { session }).exec();
      }
      await this.inventory.release(input.reservation, session);
      throw error;
    }
  }

  private async persistOrder(input: NewReservedOrder, session: ClientSession): Promise<HydratedDocument<Order>> {
    const orderCode = await nextOrderCode(this.counterModel, new Date(), session);
    const [order] = await this.orderModel.create(
      [{
        ...input.order,
        orderCode,
        ...(input.order.paymentStatus === 'PENDING'
          && input.order.paymentMethod !== 'CASH'
          && !input.order.reservationExpiresAt
          ? { reservationExpiresAt: new Date(Date.now() + PAYMENT_RESERVATION_DURATION_MS) }
          : {}),
      }],
      { session },
    );
    const documents: Array<Partial<OrderItem> & { orderId: string }> = input.items.map((item) => ({
      ...item,
      orderId: order._id.toString(),
    }));
    try {
      if (documents.length > 0) await this.orderItemModel.insertMany(documents, { session });
    } catch (error) {
      await this.orderItemModel.deleteMany({ orderId: order._id.toString() }, { session }).exec();
      await this.orderModel.deleteOne({ _id: order._id }, { session }).exec();
      throw error;
    }
    return order;
  }

  private isTransactionUnsupported(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const candidate = error as { code?: number; message?: string; codeName?: string };
    return candidate.code === 20
      || candidate.codeName === 'IllegalOperation'
      || candidate.message?.includes('Transaction numbers are only allowed') === true
      || candidate.message?.includes('replica set member or mongos') === true;
  }
}

export function isExpiredPendingOrder(order: Pick<Order, 'orderStatus' | 'paymentStatus' | 'reservationExpiresAt'>, now: Date): boolean {
  return order.orderStatus === 'PENDING'
    && order.paymentStatus === 'PENDING'
    && order.reservationExpiresAt !== undefined
    && order.reservationExpiresAt < now;
}
