import type { AdminOrderRecord } from '../orders';
import type { InventoryRecord } from '../inventory';
import type { AdminVoucherInput, AdminVoucherRecord } from '../vouchers';
import type { IssueType, OrderIssue, Paged, StaffProfile, StaffReview, SupportMessage, SupportSession } from '../staff';

const now = () => new Date().toISOString();
const paged = <T,>(all: T[], page: number, limit: number): Paged<T> => ({ items: all.slice((page - 1) * limit, page * limit), total: all.length, page, limit });

let profile: StaffProfile = {
  user: { fullName: 'Nhân viên Demo', email: 'staff@demo.vn', phoneNumber: '0900000000' },
  employee: { employeeId: 'E1', employeeCode: 'NV0001', employeeRole: 'Nhân viên cửa hàng', storeId: 'S1' },
  store: { storeId: 'S1', storeName: 'Muadee Demo', address: '1 Nguyễn Trãi, Hà Nội', phone: '0240000000' },
};

const orders: AdminOrderRecord[] = [
  { orderId: 'O1', orderCode: 'MD-0001', orderStatus: 'PENDING', totalAmount: 185000, createdAt: now(), receiveMethod: 'DELIVERY', recipientName: 'Lan', recipientPhone: '0911111111', shippingAddress: '12 Láng Hạ', paymentMethod: 'CASH', paymentStatus: 'PENDING',
    items: [{ itemId: 'I1', productId: 'P1', productName: 'Thịt heo', quantity: 1, unit: 'kg', price: 150000 }, { itemId: 'I2', productId: 'P2', productName: 'Sữa tươi', quantity: 2, unit: 'hộp', price: 17500 }] },
  { orderId: 'O2', orderCode: 'MD-0002', orderStatus: 'PREPARING', totalAmount: 96000, createdAt: now(), receiveMethod: 'PICKUP', recipientName: 'Minh', recipientPhone: '0922222222', paymentMethod: 'TRANSFER', paymentStatus: 'SUCCESS',
    items: [{ itemId: 'I3', productId: 'P3', productName: 'Cà chua', quantity: 2, unit: 'kg', price: 48000 }] },
];
const issues: OrderIssue[] = [{ issueId: 'X1', orderId: 'O1', type: 'OUT_OF_STOCK', detail: 'Hết sữa tươi', status: 'OPEN', createdAt: now() }];
const reviews: StaffReview[] = [{ reviewId: 'R1', orderId: 'O2', productId: 'P3', customerId: 'C1', rating: 4, comment: 'Cà chua tươi', isHidden: false, createdAt: now() }];
const inventory: InventoryRecord[] = [
  { storeId: 'S1', productId: 'P1', quantity: 40, reservedQuantity: 2, lowStockThreshold: 10 },
  { storeId: 'S1', productId: 'P2', quantity: 12, reservedQuantity: 4, lowStockThreshold: 10 },
];
const sessions: SupportSession[] = [{ sessionId: 'SESSION1', status: 'HANDED_OVER', handoverRequestedAt: now() }];
const messages: Record<string, SupportMessage[]> = { SESSION1: [{ senderType: 'CUSTOMER', content: 'Cho mình hỏi giờ nhận hàng?', createdAt: now() }] };
const vouchers: AdminVoucherRecord[] = [{ voucherId: 'V1', code: 'WELCOME', description: 'Chào mừng', discountValue: 20000, minOrderAmount: 100000, startDate: now(), endDate: now(), status: 'ACTIVE', usedCount: 0 }];

const find = <T,>(list: T[], pick: (item: T) => string, id: string): T => {
  const item = list.find((entry) => pick(entry) === id);
  if (!item) throw new Error('Không tìm thấy dữ liệu');
  return item;
};
const order = (id: string) => find(orders, (item) => item.orderId, id);

export const mockStaffApi = {
  profile: async () => ({ ...profile }),
  updateProfile: async (input: { fullName?: string; phoneNumber?: string; avatarUrl?: string }) => { profile = { ...profile, user: { ...profile.user, ...input } }; },

  orders: async (params: { orderStatus?: string; page: number; limit: number }) =>
    paged(orders.filter((item) => !params.orderStatus || item.orderStatus === params.orderStatus), params.page, params.limit),
  order: async (id: string) => ({ ...order(id) }),
  acceptOrder: async (id: string) => { order(id).orderStatus = 'PREPARING'; },
  cancelOrder: async (id: string) => { order(id).orderStatus = 'CANCELLED'; },
  updateStatus: async (id: string, status: string) => { order(id).orderStatus = status as AdminOrderRecord['orderStatus']; },
  updateWeight: async (id: string, itemId: string, weight: number) => {
    const item = find(order(id).items ?? [], (entry) => entry.itemId, itemId);
    item.actualWeight = weight;
  },
  reportIssue: async (id: string, type: IssueType, detail: string) => {
    issues.unshift({ issueId: `X${issues.length + 1}`, orderId: id, type, detail, status: 'OPEN', createdAt: now() });
  },

  issues: async (params: { page: number; limit: number }) => paged(issues, params.page, params.limit),
  resolveIssue: async (id: string) => { find(issues, (item) => item.issueId, id).status = 'RESOLVED'; },

  inventory: async (lowStock?: boolean) => inventory.filter((item) => !lowStock || item.quantity - item.reservedQuantity <= item.lowStockThreshold),

  reviews: async (params: { page: number; limit: number }) => paged(reviews, params.page, params.limit),
  setReviewHidden: async (id: string, hidden: boolean) => { find(reviews, (item) => item.reviewId, id).isHidden = hidden; },

  supportSessions: async (params: { page: number; limit: number }) => paged(sessions.filter((item) => item.status === 'HANDED_OVER'), params.page, params.limit),
  claimSession: async (id: string) => { find(sessions, (item) => item.sessionId, id).employeeId = 'E1'; },
  sessionMessages: async (id: string) => [...(messages[id] ?? [])],
  reply: async (id: string, content: string) => { (messages[id] ??= []).push({ senderType: 'STAFF', content, createdAt: now() }); },
  closeSession: async (id: string) => { find(sessions, (item) => item.sessionId, id).status = 'CLOSED'; },

  vouchers: async () => vouchers.map((item) => ({ ...item })),
  createVoucher: async (input: AdminVoucherInput) => { vouchers.unshift({ ...input, voucherId: `V${vouchers.length + 1}`, usedCount: 0 }); },
  updateVoucher: async (id: string, input: Partial<AdminVoucherInput>) => { Object.assign(find(vouchers, (item) => item.voucherId, id), input); },
  deleteVoucher: async (id: string) => { vouchers.splice(vouchers.indexOf(find(vouchers, (item) => item.voucherId, id)), 1); },
};
