import type { UserProfile } from '../../types/user';
import type { MembershipSummary, PointHistoryItem } from '../../types/membership';
import type { CustomerOrder } from '../../types/order';
import type { OrderTrackingEvent } from '../../types/order';
import type { CustomerReview } from '../../types/review';
import type { ChatSession } from '../../types/chat';
import { mockProducts } from './data';

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
  { orderId: 'ord-01', orderCode: 'MD261025014', createdAt: '2026-10-25T10:20:00+07:00', totalAmount: 217480, orderStatus: 'SHIPPING', receiveMethod: 'DELIVERY', recipientName: 'Nguyễn Minh Anh', recipientPhone: '0901234567', shippingAddress: '128 Nguyễn Trãi, Phường 3, Quận 5, TP. Hồ Chí Minh', shippingFee: 20000, paymentMethod: 'TRANSFER', paymentStatus: 'SUCCESS', transactionId: 'TX-MD261025014', paidAt: '2026-10-25T10:24:00+07:00', carrierName: 'Muadee Express', trackingCode: 'MDE261025014', items: [{ itemId: 'ord-01-1', productId: 'p-01', productName: 'Rau cải ngọt hữu cơ', image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=160&q=80', quantity: 2, unit: 'gói', price: 24000 }, { itemId: 'ord-01-2', productId: 'p-04', productName: 'Cam vàng mọng nước', image: 'https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=160&q=80', quantity: 1, actualWeight: 1.08, unit: 'kg', price: 56000 }, { itemId: 'ord-01-3', productId: 'p-02', productName: 'Dâu tây Đà Lạt', image: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=160&q=80', quantity: 1, unit: 'hộp', price: 89000 }] },
  { orderId: 'ord-02', orderCode: 'MD261020006', createdAt: '2026-10-20T15:40:00+07:00', totalAmount: 131000, orderStatus: 'DELIVERED', receiveMethod: 'PICKUP', storeId: 'store-nguyen-trai', pickupTime: '17:00–19:00', paymentMethod: 'CARD', paymentStatus: 'SUCCESS', transactionId: 'TX-MD261020006', paidAt: '2026-10-20T15:42:00+07:00', items: [{ itemId: 'ord-02-1', productId: 'p-02', productName: 'Dâu tây Đà Lạt', image: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=160&q=80', quantity: 1, unit: 'hộp', price: 89000 }, { itemId: 'ord-02-2', productId: 'p-05', productName: 'Trứng gà thả vườn', image: 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=160&q=80', quantity: 1, unit: 'hộp', price: 42000 }] },
  { orderId: 'ord-03', orderCode: 'MD261015021', createdAt: '2026-10-15T08:15:00+07:00', totalAmount: 165600, orderStatus: 'DELIVERED', receiveMethod: 'DELIVERY', recipientName: 'Nguyễn Minh Anh', recipientPhone: '0901234567', shippingAddress: '128 Nguyễn Trãi, Phường 3, Quận 5, TP. Hồ Chí Minh', shippingFee: 20000, paymentMethod: 'CASH', paymentStatus: 'SUCCESS', items: [{ itemId: 'ord-03-1', productId: 'p-03', productName: 'Cà chua bi đỏ', image: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=160&q=80', quantity: 2, unit: 'gói', price: 32000 }, { itemId: 'ord-03-2', productId: 'p-06', productName: 'Bơ sáp chín tự nhiên', image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=160&q=80', quantity: 1, actualWeight: 1.2, unit: 'kg', price: 68000 }] },
  { orderId: 'ord-04', orderCode: 'MD261028001', createdAt: '2026-10-28T08:15:00+07:00', totalAmount: 128000, subtotal: 108000, shippingFee: 20000, orderStatus: 'PENDING', receiveMethod: 'DELIVERY', recipientName: 'Nguyễn Minh Anh', recipientPhone: '0901234567', shippingAddress: '128 Nguyễn Trãi, Phường 3, Quận 5, TP. Hồ Chí Minh', paymentMethod: 'TRANSFER', paymentStatus: 'PENDING', items: makeMockItems('ord-04', ['p-04', 'p-05']) },
  { orderId: 'ord-05', orderCode: 'MD261027004', createdAt: '2026-10-27T13:05:00+07:00', totalAmount: 89000, subtotal: 89000, orderStatus: 'PREPARING', receiveMethod: 'PICKUP', storeId: 'store-nguyen-trai', pickupTime: '17:00–19:00', paymentMethod: 'CASH', paymentStatus: 'PENDING', items: makeMockItems('ord-05', ['p-02']) },
  { orderId: 'ord-06', orderCode: 'MD261026012', createdAt: '2026-10-26T11:10:00+07:00', totalAmount: 68000, subtotal: 68000, orderStatus: 'READY_FOR_PICKUP', receiveMethod: 'PICKUP', storeId: 'store-vo-van-tan', pickupTime: '19:00–21:00', paymentMethod: 'TRANSFER', paymentStatus: 'SUCCESS', transactionId: 'TX-MD261026012', paidAt: '2026-10-26T11:12:00+07:00', items: makeMockItems('ord-06', ['p-06']) },
  { orderId: 'ord-07', orderCode: 'MD261024009', createdAt: '2026-10-24T10:00:00+07:00', totalAmount: 74000, subtotal: 54000, shippingFee: 20000, orderStatus: 'CANCELLED', receiveMethod: 'DELIVERY', paymentMethod: 'CARD', paymentStatus: 'REFUNDED', transactionId: 'TX-MD261024009', paidAt: '2026-10-24T10:02:00+07:00', items: makeMockItems('ord-07', ['p-03', 'p-01']) },
  { orderId: 'ord-08', orderCode: 'MD261023003', createdAt: '2026-10-23T09:30:00+07:00', totalAmount: 68000, subtotal: 68000, orderStatus: 'RETURNING', receiveMethod: 'DELIVERY', paymentMethod: 'TRANSFER', paymentStatus: 'SUCCESS', transactionId: 'TX-MD261023003', paidAt: '2026-10-23T09:32:00+07:00', items: makeMockItems('ord-08', ['p-06']) },
  { orderId: 'ord-09', orderCode: 'MD261022017', createdAt: '2026-10-22T14:45:00+07:00', totalAmount: 89000, subtotal: 89000, orderStatus: 'RETURNED', receiveMethod: 'PICKUP', storeId: 'store-nguyen-trai', pickupTime: '15:00–17:00', paymentMethod: 'CARD', paymentStatus: 'REFUNDED', transactionId: 'TX-MD261022017', paidAt: '2026-10-22T14:47:00+07:00', items: makeMockItems('ord-09', ['p-02']) },
];

function makeMockItems(orderId: string, productIds: string[]): NonNullable<CustomerOrder['items']> {
  return productIds.map((productId, index) => {
    const product = mockProducts.find((item) => item.productId === productId);
    if (!product) throw new Error(`Không tìm thấy sản phẩm mock ${productId}`);
    return { itemId: `${orderId}-${index + 1}`, productId, productName: product.productName, image: product.image, quantity: 1, unit: product.unit, price: product.salePrice ?? product.price };
  });
}

export const mockTrackingEvents: OrderTrackingEvent[] = [
  { time: '2026-10-25T10:20:00+07:00', status: 'WAITING_PICKUP', location: 'Cửa hàng Muadee Nguyễn Trãi' },
  { time: '2026-10-25T11:05:00+07:00', status: 'PICKED_UP', location: 'Đơn vị vận chuyển đã nhận hàng' },
  { time: '2026-10-25T11:40:00+07:00', status: 'IN_TRANSIT', location: 'Trung tâm phân loại Quận 5' },
  { time: '2026-10-25T12:15:00+07:00', status: 'IN_TRANSIT', location: 'Đang giao đến địa chỉ nhận' },
];

export const mockReviews: CustomerReview[] = [
  { reviewId: 'rv-01', orderId: 'ord-03', productId: 'p-01', productName: 'Rau cải ngọt hữu cơ', productImage: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=160&q=80', status: 'PENDING', deliveredAt: '2026-10-15T08:15:00+07:00' },
  { reviewId: 'rv-02', orderId: 'ord-02', productId: 'p-02', productName: 'Dâu tây Đà Lạt', productImage: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=160&q=80', status: 'REVIEWED', rating: 5, comment: 'Trái cây tươi, đóng gói cẩn thận.', createdAt: '2026-10-21T11:00:00+07:00' },
];

export const mockSupportHistory: ChatSession[] = [
  { sessionId: 'support-02', status: 'HANDED_OVER', agentName: 'Minh Anh', startedAt: '2026-10-27T14:00:00+07:00', messages: [{ id: 'm-03', role: 'user', content: 'Đơn của mình đang được xử lý đến đâu?' }, { id: 'm-04', role: 'assistant', content: 'Mình đang kết nối bạn với nhân viên để hỗ trợ tra cứu.' }, { id: 'm-05', role: 'staff', content: 'Chào bạn, mình đang kiểm tra trạng thái đơn hàng.' }] },
  { sessionId: 'support-01', status: 'CLOSED', agentName: 'Minh Anh', startedAt: '2026-10-21T09:10:00+07:00', messages: [{ id: 'm-01', role: 'user', content: 'Cho mình hỏi về thời gian giao hàng.' }, { id: 'm-02', role: 'staff', content: 'Đơn hàng thường được giao trong ngày theo khung giờ bạn chọn.' }] },
];