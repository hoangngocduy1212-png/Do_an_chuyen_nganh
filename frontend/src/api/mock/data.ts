import type { Category } from '../../types';
import type { Product } from '../../types/product';
import type { Voucher } from '../../types/voucher';
import type { StoreLocation } from '../../types/store';

export const mockCategories: Category[] = [
  { _id: 'rau-cu', categoryName: 'Rau củ', description: 'Tươi mỗi ngày' },
  { _id: 'trai-cay', categoryName: 'Trái cây', description: 'Theo mùa' },
  { _id: 'thit-ca', categoryName: 'Thịt, cá', description: 'Chọn lọc mỗi ngày' },
  { _id: 'sua-trung', categoryName: 'Sữa, trứng', description: 'Dinh dưỡng cho nhà' },
  { _id: 'do-kho', categoryName: 'Đồ khô', description: 'Đủ đầy gian bếp' },
  { _id: 'do-uong', categoryName: 'Đồ uống', description: 'Mát lành sảng khoái' },
];

export const mockStores: StoreLocation[] = [
  { _id: 'store-nguyen-trai', name: 'Chi nhánh Nguyễn Trãi, Q.5', address: '237 Nguyễn Trãi, Phường 7, Quận 5, TP. Hồ Chí Minh', status: 'ACTIVE' },
  { _id: 'store-vo-van-tan', name: 'Chi nhánh Võ Văn Tần, Q.3', address: '118 Võ Văn Tần, Phường 5, Quận 3, TP. Hồ Chí Minh', status: 'ACTIVE' },
  { _id: 'store-phu-nhuan', name: 'Chi nhánh Phan Xích Long, Phú Nhuận', address: '42 Phan Xích Long, Phường 3, Phú Nhuận, TP. Hồ Chí Minh', status: 'ACTIVE' },
];

export const mockProducts: Product[] = [
  { productId: 'p-01', productName: 'Rau cải ngọt hữu cơ', categoryId: 'rau-cu', categoryName: 'Rau củ', price: 30000, salePrice: 24000, saleStartDate: '2026-10-01T00:00:00+07:00', saleEndDate: '2026-10-28T23:59:59+07:00', unit: 'gói', image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=640&q=85', status: 'ACTIVE', avgRating: 4.6, reviewCount: 128, stock: 32, soldCount: 182, badge: 'Tươi hôm nay' },
  { productId: 'p-02', productName: 'Dâu tây Đà Lạt', categoryId: 'trai-cay', categoryName: 'Trái cây', price: 105000, salePrice: 89000, saleStartDate: '2026-10-01T00:00:00+07:00', saleEndDate: '2026-10-29T12:00:00+07:00', originalPrice: 105000, unit: 'hộp', image: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=640&q=85', status: 'ACTIVE', avgRating: 4.8, reviewCount: 86, stock: 18, soldCount: 164, badge: 'Đang ưu đãi' },
  { productId: 'p-03', productName: 'Cà chua bi đỏ', categoryId: 'rau-cu', categoryName: 'Rau củ', price: 32000, unit: 'gói', image: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=640&q=85', status: 'ACTIVE', avgRating: 4.7, reviewCount: 74, stock: 24 },
  { productId: 'p-04', productName: 'Cam vàng mọng nước', categoryId: 'trai-cay', categoryName: 'Trái cây', price: 56000, originalPrice: 62000, unit: 'kg', image: 'https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=640&q=85', status: 'ACTIVE', avgRating: 4.8, reviewCount: 92, stock: 16 },
  { productId: 'p-05', productName: 'Trứng gà thả vườn', categoryId: 'sua-trung', categoryName: 'Sữa, trứng', price: 42000, unit: 'hộp', image: 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=640&q=85', status: 'ACTIVE', avgRating: 4.9, reviewCount: 105, stock: 21 },
  { productId: 'p-06', productName: 'Bơ sáp chín tự nhiên', categoryId: 'trai-cay', categoryName: 'Trái cây', price: 68000, originalPrice: 75000, unit: 'kg', image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=640&q=85', status: 'ACTIVE', avgRating: 4.8, reviewCount: 66, stock: 13 },
  { productId: 'p-07', productName: 'Nấm đùi gà tươi', categoryId: 'rau-cu', categoryName: 'Rau củ', price: 36000, unit: 'gói', image: 'https://images.unsplash.com/photo-1504545102780-26774c1bb073?auto=format&fit=crop&w=640&q=85', status: 'ACTIVE', avgRating: 4.6, reviewCount: 48, stock: 19 },
  { productId: 'p-08', productName: 'Sữa tươi thanh trùng', categoryId: 'sua-trung', categoryName: 'Sữa, trứng', price: 39000, unit: 'chai', image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=640&q=85', status: 'ACTIVE', avgRating: 4.8, reviewCount: 115, stock: 28 },
  { productId: 'p-09', productName: 'Bắp cải Đà Lạt', categoryId: 'rau-cu', categoryName: 'Rau củ', price: 28000, unit: 'kg', image: '', status: 'ACTIVE', avgRating: 4.5, reviewCount: 31, stock: 0 },
  { productId: 'p-10', productName: 'Rau muống đồng', categoryId: 'rau-cu', categoryName: 'Rau củ', price: 18000, unit: 'kg', image: '/mock/anh-khong-ton-tai.jpg', status: 'ACTIVE', avgRating: 4.4, reviewCount: 26, stock: 6 },
  { productId: 'p-11', productName: 'Bánh quy bơ hộp thiếc', categoryId: 'do-kho', categoryName: 'Đồ khô', price: 72000, salePrice: 59000, saleStartDate: '2026-08-01T00:00:00+07:00', saleEndDate: '2026-10-01T23:59:59+07:00', unit: 'hộp', image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=640&q=85', status: 'ACTIVE', avgRating: 4.3, reviewCount: 19, stock: 9, soldCount: 34 },
];

export const mockStockByStore: Record<string, Record<string, number>> = {
  'store-nguyen-trai': { 'p-01': 32, 'p-02': 18, 'p-03': 8, 'p-04': 16, 'p-05': 21, 'p-06': 13, 'p-07': 0, 'p-08': 28, 'p-09': 0, 'p-10': 6 },
  'store-vo-van-tan': { 'p-01': 5, 'p-02': 0, 'p-03': 14, 'p-04': 6, 'p-05': 12, 'p-06': 0, 'p-07': 3, 'p-08': 9, 'p-09': 2, 'p-10': 12 },
  'store-phu-nhuan': { 'p-01': 0, 'p-02': 11, 'p-03': 4, 'p-04': 18, 'p-05': 7, 'p-06': 3, 'p-07': 16, 'p-08': 0, 'p-09': 1, 'p-10': 0 },
};

export const homeVoucher: Voucher = { voucherId: 'voucher-sale20', code: 'SALE20', discountValue: 20000, minimumOrder: 199000, startDate: '2026-01-01T00:00:00+07:00', endDate: '2026-11-30T23:59:59+07:00' };

export const mockVouchers: Voucher[] = [
  homeVoucher,
  { voucherId: 'voucher-fresh15', code: 'FRESH15', discountValue: 15000, minimumOrder: 149000, startDate: '2026-01-01T00:00:00+07:00', endDate: '2026-10-30T23:59:59+07:00' },
  { voucherId: 'voucher-expired', code: 'OLD10', discountValue: 10000, minimumOrder: 99000, startDate: '2026-01-01T00:00:00+07:00', endDate: '2026-10-01T23:59:59+07:00' },
];