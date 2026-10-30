import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

const dashboardCollections = [
  'aifeedbacks', 'aiconfigs', 'carts', 'cartitems', 'categories', 'chatmessages', 'chatsessions',
  'counters', 'customers', 'deliveries', 'demandforecasts', 'employees', 'inventories',
  'knowledgedocuments', 'memberships', 'membershiplevels', 'orderitems', 'orders', 'payments',
  'pointtransactions', 'products', 'reviews', 'stores', 'users', 'useractivities', 'vouchers',
] as const;

interface RevenueMonthRow {
  _id: string;
  revenue: number;
  payments: number;
}

interface OrderStatusRow {
  _id: string;
  count: number;
}

interface RoleCountRow {
  _id: string;
  count: number;
}

interface StatusCountRow {
  _id: string;
  count: number;
}

@Injectable()
export class AdminDashboardService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async overview() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const chartStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

    const [
      collectionCounts,
      revenueMonths,
      orderCount,
      todayOrderCount,
      ordersByStatus,
      productCount,
      productsByStatus,
      categoryCount,
      storesByStatus,
      vouchersByStatus,
      userCount,
      usersByRole,
      inventoryCount,
      lowStockCount,
    ] = await Promise.all([
      Promise.all(dashboardCollections.map(async (collection) => ({
        collection,
        documents: await this.connection.collection(collection).estimatedDocumentCount(),
      }))),
      this.connection.collection('payments').aggregate<RevenueMonthRow>([
        { $match: { paymentStatus: 'SUCCESS', paidAt: { $gte: chartStart } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$paidAt', timezone: 'Asia/Ho_Chi_Minh' } },
          revenue: { $sum: '$amount' },
          payments: { $sum: 1 },
        } },
        { $sort: { _id: 1 } },
      ]).toArray(),
      this.connection.collection('orders').estimatedDocumentCount(),
      this.connection.collection('orders').countDocuments({ createdAt: { $gte: todayStart } }),
      this.connection.collection('orders').aggregate<OrderStatusRow>([
        { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).toArray(),
      this.connection.collection('products').estimatedDocumentCount(),
      this.connection.collection('products').aggregate<StatusCountRow>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]).toArray(),
      this.connection.collection('categories').estimatedDocumentCount(),
      this.connection.collection('stores').aggregate<StatusCountRow>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]).toArray(),
      this.connection.collection('vouchers').aggregate<StatusCountRow>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]).toArray(),
      this.connection.collection('users').estimatedDocumentCount(),
      this.connection.collection('users').aggregate<RoleCountRow>([
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]).toArray(),
      this.connection.collection('inventories').estimatedDocumentCount(),
      this.connection.collection('inventories').countDocuments({
        $expr: { $lte: [{ $subtract: ['$quantity', { $ifNull: ['$reservedQuantity', 0] }] }, { $ifNull: ['$lowStockThreshold', 10] }] },
      }),
    ]);

    const filledRevenue = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1));
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      const record = revenueMonths.find((month) => month._id === key);
      return { month: key, revenue: record?.revenue ?? 0, payments: record?.payments ?? 0 };
    });
    const statusMap = (rows: StatusCountRow[]) => Object.fromEntries(rows.map((row) => [row._id || 'UNKNOWN', row.count]));

    return {
      generatedAt: now.toISOString(),
      collectionCount: dashboardCollections.length,
      documentCount: collectionCounts.reduce((sum, item) => sum + item.documents, 0),
      collectionCounts,
      metrics: {
        totalOrders: orderCount,
        todayOrders: todayOrderCount,
        totalProducts: productCount,
        activeProducts: statusMap(productsByStatus).ACTIVE ?? 0,
        totalCategories: categoryCount,
        activeStores: statusMap(storesByStatus).ACTIVE ?? 0,
        totalStores: storesByStatus.reduce((sum, item) => sum + item.count, 0),
        activeVouchers: statusMap(vouchersByStatus).ACTIVE ?? 0,
        totalCustomers: usersByRole.find((item) => item._id === 'CUSTOMER')?.count ?? 0,
        totalUsers: userCount,
        inventoryRows: inventoryCount,
        lowStockRows: lowStockCount,
        paidRevenueThisMonth: filledRevenue.at(-1)?.revenue ?? 0,
      },
      revenueMonths: filledRevenue,
      ordersByStatus: statusMap(ordersByStatus),
      usersByRole: statusMap(usersByRole),
    };
  }
}
