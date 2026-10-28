import type { UserProfile } from '../../types/user';
import type { MembershipSummary, PointHistoryItem } from '../../types/membership';
import type { CustomerOrder } from '../../types/order';
import type { CustomerReview } from '../../types/review';
import type { ChatSession } from '../../types/chat';

export const mockUserProfile: UserProfile = {
  userId: 'mock-customer-01',
  fullName: 'Nguyễn Minh Anh',
  email: 'khachhang@muadee.vn',
  phoneNumber: '0901234567',
  role: 'CUSTOMER',
  createdAt: '2024-01-18T08:30:00+07:00',
  defaultAddress: '128 Nguyễn Trãi, Phường 3, Quận 5, TP. Hồ Chí Minh',
};

export const mockMembership: MembershipSummary = {
  pointBalance: 2480,
  memberLevel: 'Vàng',
  memberCode: 'MD-2401-0088',
  lifetimePoints: 2480,
  levels: [
    { name: 'Thường', minPoints: 0, benefits: 'Tích điểm và nhận ưu đãi theo mùa.' },
    { name: 'Bạc', minPoints: 500, benefits: 'Ưu đãi thành viên và tích điểm mỗi đơn hàng.' },
    { name: 'Vàng', minPoints: 1000, benefits: 'Ưu đãi riêng, tích điểm nhanh hơn.' },
    { name: 'Kim cương', minPoints: 3000, benefits: 'Đặc quyền cao nhất và ưu đãi độc quyền.' },
  ],
};

export const mockPointHistory: PointHistoryItem[] = [
  { id: 'pt-01', description: 'Mua hàng – đơn MD-1024', points: 120, createdAt: '2026-10-25T10:20:00+07:00', balanceAfter: 2480 },
  { id: 'pt-02', description: 'Đổi điểm – đơn MD-1031', points: -200, createdAt: '2026-10-12T14:05:00+07:00', balanceAfter: 2360 },
  { id: 'pt-03', description: 'Điều chỉnh', points: 180, createdAt: '2026-10-10T09:30:00+07:00', balanceAfter: 2560 },
  { id: 'pt-04', description: 'Mua hàng – đơn MD-1008', points: 95, createdAt: '2026-10-04T13:15:00+07:00', balanceAfter: 2380 },
  { id: 'pt-05', description: 'Mua hàng – đơn MD-0991', points: 160, createdAt: '2026-09-28T10:20:00+07:00', balanceAfter: 2285 },
  { id: 'pt-06', description: 'Đổi điểm – đơn MD-0970', points: -150, createdAt: '2026-09-17T14:05:00+07:00', balanceAfter: 2125 },
  { id: 'pt-07', description: 'Mua hàng – đơn MD-0952', points: 210, createdAt: '2026-09-10T09:30:00+07:00', balanceAfter: 2275 },
  { id: 'pt-08', description: 'Mua hàng – đơn MD-0936', points: 85, createdAt: '2026-08-29T13:15:00+07:00', balanceAfter: 2065 },
  { id: 'pt-09', description: 'Điều chỉnh', points: 40, createdAt: '2026-08-18T10:20:00+07:00', balanceAfter: 1980 },
  { id: 'pt-10', description: 'Mua hàng – đơn MD-0902', points: 175, createdAt: '2026-08-07T14:05:00+07:00', balanceAfter: 1940 },
  { id: 'pt-11', description: 'Đổi điểm – đơn MD-0880', points: -100, createdAt: '2026-07-26T09:30:00+07:00', balanceAfter: 1765 },
  { id: 'pt-12', description: 'Mua hàng – đơn MD-0864', points: 140, createdAt: '2026-07-15T13:15:00+07:00', balanceAfter: 1865 },
];

export const mockOrders: CustomerOrder[] = [
  { orderId: 'ord-01', orderCode: 'MD261025014', createdAt: '2026-10-25T10:20:00+07:00', totalAmount: 248000, orderStatus: 'SHIPPING' },
  { orderId: 'ord-02', orderCode: 'MD261020006', createdAt: '2026-10-20T15:40:00+07:00', totalAmount: 186500, orderStatus: 'DELIVERED' },
  { orderId: 'ord-03', orderCode: 'MD261015021', createdAt: '2026-10-15T08:15:00+07:00', totalAmount: 325000, orderStatus: 'DELIVERED' },
];

export const mockReviews: CustomerReview[] = [
  { reviewId: 'rv-01', orderId: 'ord-03', productId: 'p-01', productName: 'Rau cải ngọt hữu cơ', productImage: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=160&q=80', status: 'PENDING', deliveredAt: '2026-10-15T08:15:00+07:00' },
  { reviewId: 'rv-02', orderId: 'ord-02', productId: 'p-02', productName: 'Dâu tây Đà Lạt', productImage: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=160&q=80', status: 'REVIEWED', rating: 5, comment: 'Trái cây tươi, đóng gói cẩn thận.', createdAt: '2026-10-21T11:00:00+07:00' },
];

export const mockSupportHistory: ChatSession[] = [
  { sessionId: 'support-02', status: 'HANDED_OVER', agentName: 'Minh Anh', startedAt: '2026-10-27T14:00:00+07:00', messages: [{ id: 'm-03', role: 'user', content: 'Đơn của mình đang được xử lý đến đâu?' }, { id: 'm-04', role: 'assistant', content: 'Mình đang kết nối bạn với nhân viên để hỗ trợ tra cứu.' }, { id: 'm-05', role: 'staff', content: 'Chào bạn, mình đang kiểm tra trạng thái đơn hàng.' }] },
  { sessionId: 'support-01', status: 'CLOSED', agentName: 'Minh Anh', startedAt: '2026-10-21T09:10:00+07:00', messages: [{ id: 'm-01', role: 'user', content: 'Cho mình hỏi về thời gian giao hàng.' }, { id: 'm-02', role: 'staff', content: 'Đơn hàng thường được giao trong ngày theo khung giờ bạn chọn.' }] },
];