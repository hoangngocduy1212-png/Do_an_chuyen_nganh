import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model } from 'mongoose';
import { InventoryRequest, InventoryService } from '../inventory/inventory.service';
import { Order } from './schemas/order.schema';
import { OrderItem } from '../order-items/schemas/order-item.schema';

@Injectable()
export class OrderReservationExpiryService {
  private readonly logger = new Logger(OrderReservationExpiryService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(OrderItem.name) private readonly orderItems: Model<OrderItem>,
    private readonly inventory: InventoryService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expirePendingReservations(): Promise<void> {
    const now = new Date();
    const expiredOrders = await this.orders.find({
      orderStatus: 'PENDING',
      paymentStatus: 'PENDING',
      reservationExpiresAt: { $lt: now },
    }).select('_id storeId').lean().exec();

    for (const expired of expiredOrders) {
      const session = await this.connection.startSession();
      try {
        await session.withTransaction(async () => {
          const claimed = await this.orders.findOneAndUpdate(
            {
              _id: expired._id,
              orderStatus: 'PENDING',
              paymentStatus: 'PENDING',
              reservationExpiresAt: { $lt: now },
            },
            { $set: { orderStatus: 'CANCELLED', cancelReason: 'Hết thời gian giữ tồn kho' }, $unset: { reservationExpiresAt: 1 } },
            { new: true, session },
          ).exec();
          if (!claimed) return;

          const items = await this.orderItems.find({ orderId: claimed._id.toString() })
            .select('productId quantity').session(session).lean().exec();
          const reservations: InventoryRequest[] = items.map((item) => ({
            storeId: claimed.storeId,
            productId: item.productId,
            quantity: item.quantity,
          }));
          await this.inventory.release(reservations, session);
        });
      } catch (error) {
        if (!this.isTransactionUnsupported(error)) throw error;
        this.logger.warn(`MongoDB không hỗ trợ transaction khi giải phóng đơn ${String(expired._id)}; dùng cleanup tuần tự`);
        await this.expireWithoutTransaction(expired._id, now, session);
      } finally {
        await session.endSession();
      }
    }
  }

  private async expireWithoutTransaction(orderId: unknown, now: Date, session: ClientSession): Promise<void> {
    const claimed = await this.orders.findOneAndUpdate(
      { _id: orderId, orderStatus: 'PENDING', paymentStatus: 'PENDING', reservationExpiresAt: { $lt: now } },
      { $set: { orderStatus: 'CANCELLED', cancelReason: 'Hết thời gian giữ tồn kho' }, $unset: { reservationExpiresAt: 1 } },
      { new: true, session },
    ).exec();
    if (!claimed) return;

    try {
      const items = await this.orderItems.find({ orderId: claimed._id.toString() })
        .select('productId quantity').session(session).lean().exec();
      await this.inventory.release(items.map((item) => ({
        storeId: claimed.storeId,
        productId: item.productId,
        quantity: item.quantity,
      })), session);
    } catch (error) {
      await this.orders.updateOne(
        { _id: claimed._id, orderStatus: 'CANCELLED' },
        { $set: { orderStatus: 'PENDING' }, $unset: { cancelReason: 1 } },
        { session },
      ).exec();
      throw error;
    }
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
