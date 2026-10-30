import { http, isMockEnabled, unwrapApiResponse } from './client';
import { mockOrders } from './mock/account';
import { mockCategories, mockProducts, mockStockByStore, mockStores, mockVouchers } from './mock/data';

export interface DashboardCollectionCount {
  collection: string;
  documents: number;
}

export interface AdminDashboardOverview {
  generatedAt: string;
  collectionCount: number;
  documentCount: number;
  collectionCounts: DashboardCollectionCount[];
  metrics: {
    totalOrders: number;
    todayOrders: number;
    totalProducts: number;
    activeProducts: number;
    totalCategories: number;
    activeStores: number;
    totalStores: number;
    activeVouchers: number;
    totalCustomers: number;
    totalUsers: number;
    inventoryRows: number;
    lowStockRows: number;
    paidRevenueThisMonth: number;
  };
  revenueMonths: Array<{ month: string; revenue: number; payments: number }>;
  ordersByStatus: Record<string, number>;
  usersByRole: Record<string, number>;
}

const collectionNames = [
  'aifeedbacks', 'aiconfigs', 'carts', 'cartitems', 'categories', 'chatmessages', 'chatsessions',
  'counters', 'customers', 'deliveries', 'demandforecasts', 'employees', 'inventories',
  'knowledgedocuments', 'memberships', 'membershiplevels', 'orderitems', 'orders', 'payments',
  'pointtransactions', 'products', 'reviews', 'stores', 'users', 'useractivities', 'vouchers',
];

function mockOverview(): AdminDashboardOverview {
  const now = new Date();
  const successfulOrders = mockOrders.filter((order) => order.paymentStatus === 'SUCCESS');
  const collectionCountByName: Record<string, number> = {
    categories: mockCategories.length,
    products: mockProducts.length,
    stores: mockStores.length,
    orders: mockOrders.length,
    payments: successfulOrders.length,
    vouchers: mockVouchers.length,
    inventories: Object.values(mockStockByStore).reduce((sum, items) => sum + Object.keys(items).length, 0),
  };
  const revenueMonths = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1));
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const matching = successfulOrders.filter((order) => (order.paidAt ?? order.createdAt).slice(0, 7) === month);
    return { month, revenue: matching.reduce((sum, order) => sum + order.totalAmount, 0), payments: matching.length };
  });
  const ordersByStatus = Object.fromEntries([...new Set(mockOrders.map((order) => order.orderStatus))].map((status) => [status, mockOrders.filter((order) => order.orderStatus === status).length]));
  const collectionCounts = collectionNames.map((collection) => ({ collection, documents: collectionCountByName[collection] ?? 0 }));
  return {
    generatedAt: now.toISOString(),
    collectionCount: collectionNames.length,
    documentCount: collectionCounts.reduce((sum, item) => sum + item.documents, 0),
    collectionCounts,
    metrics: {
      totalOrders: mockOrders.length,
      todayOrders: mockOrders.filter((order) => order.createdAt.slice(0, 10) === now.toISOString().slice(0, 10)).length,
      totalProducts: mockProducts.length,
      activeProducts: mockProducts.filter((product) => product.status === 'ACTIVE').length,
      totalCategories: mockCategories.length,
      activeStores: mockStores.filter((store) => store.status === 'ACTIVE').length,
      totalStores: mockStores.length,
      activeVouchers: mockVouchers.length,
      totalCustomers: 0,
      totalUsers: 0,
      inventoryRows: collectionCountByName.inventories,
      lowStockRows: 0,
      paidRevenueThisMonth: revenueMonths.at(-1)?.revenue ?? 0,
    },
    revenueMonths,
    ordersByStatus,
    usersByRole: {},
  };
}

export const adminDashboardApi = {
  overview: async (): Promise<AdminDashboardOverview> => {
    if (isMockEnabled) return mockOverview();
    const response = await http.get<{ success: true; data: AdminDashboardOverview }>('/admin/dashboard');
    return unwrapApiResponse(response);
  },
};
