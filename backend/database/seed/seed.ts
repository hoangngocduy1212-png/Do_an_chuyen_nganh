import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as bcrypt from 'bcryptjs';
import { Connection, Schema, Types, createConnection } from 'mongoose';
import {
  AIFeedbackSchema,
} from '../../src/modules/ai-feedback/schemas/ai-feedback.schema';
import { AIConfigSchema } from '../../src/modules/ai-config/schemas/ai-config.schema';
import { CartSchema } from '../../src/modules/carts/schemas/cart.schema';
import { CartItemSchema } from '../../src/modules/cart-items/schemas/cart-item.schema';
import { CategorySchema } from '../../src/modules/categories/schemas/category.schema';
import { ChatMessageSchema } from '../../src/modules/chat-messages/schemas/chat-message.schema';
import { ChatSessionSchema } from '../../src/modules/chat-sessions/schemas/chat-session.schema';
import { CounterSchema } from '../../src/modules/counters/schemas/counter.schema';
import { CustomerSchema } from '../../src/modules/customers/schemas/customer.schema';
import { DeliverySchema } from '../../src/modules/deliveries/schemas/delivery.schema';
import { DemandForecastSchema } from '../../src/modules/demand-forecasts/schemas/demand-forecast.schema';
import { EmployeeSchema } from '../../src/modules/employees/schemas/employee.schema';
import { InventorySchema } from '../../src/modules/inventory/schemas/inventory.schema';
import { KnowledgeDocumentSchema } from '../../src/modules/knowledge-documents/schemas/knowledge-document.schema';
import { MembershipSchema } from '../../src/modules/memberships/schemas/membership.schema';
import { MembershipLevelSchema } from '../../src/modules/membership-levels/schemas/membership-level.schema';
import { OrderItemSchema } from '../../src/modules/order-items/schemas/order-item.schema';
import { OrderSchema } from '../../src/modules/orders/schemas/order.schema';
import { PaymentSchema } from '../../src/modules/payments/schemas/payment.schema';
import { PointTransactionSchema } from '../../src/modules/point-transactions/schemas/point-transaction.schema';
import { ProductSchema } from '../../src/modules/products/schemas/product.schema';
import { ReviewSchema } from '../../src/modules/reviews/schemas/review.schema';
import { StoreSchema } from '../../src/modules/stores/schemas/store.schema';
import { UserSchema } from '../../src/modules/users/schemas/user.schema';
import { UserActivitySchema } from '../../src/modules/user-activities/schemas/user-activity.schema';
import { VoucherSchema } from '../../src/modules/vouchers/schemas/voucher.schema';

type SeedRecord = Record<string, unknown>;

function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
}

interface SeedCollection {
  name: string;
  collection: string;
  idField: string;
  schema: Schema;
  records: SeedRecord[];
}

interface SeedProduct {
  productId: string;
  productName: string;
  categoryId: string;
  price: number;
  unit: string;
  weighted: boolean;
}

interface SeedAccount {
  customer?: boolean;
  email: string;
  name: string;
  role: string;
  status: string;
}

const SEED = 20261028;
let randomState = SEED;
const idPrefixes: Record<string, string> = {
  user: '00000001',
  customer: '00000002',
  cart: '00000003',
  membership: '00000004',
  employee: '00000005',
  category: '00000006',
  product: '00000007',
  store: '00000008',
  order: '00000009',
  orderItem: '0000000a',
  delivery: '0000000b',
  payment: '0000000c',
  inventory: '00000017',
  membershipLevel: '0000000d',
  counter: '0000000e',
  review: '0000000f',
  pointTransaction: '00000010',
  knowledge: '00000011',
  aiConfig: '00000012',
  forecast: '00000013',
  activity: '00000014',
  aiFeedback: '00000015',
  voucher: '00000016',
};

function random(): number {
  randomState = (randomState * 48271) % 2147483647;
  return randomState / 2147483647;
}

function idFor(kind: string, index: number): string {
  const prefix = idPrefixes[kind];
  if (!prefix) throw new Error(`Chưa khai báo namespace ObjectId cho ${kind}`);
  return `${prefix}${index.toString(16).padStart(16, '0')}`;
}

function loadMongoUri(): string {
  if (!process.env.MONGODB_URI) {
    const files = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '..', '.env')];
    for (const file of files) {
      if (!existsSync(file)) continue;
      for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*(?:export\s+)?MONGODB_URI\s*=\s*(.*?)\s*$/);
        if (!match) continue;
        const uri = match[1].replace(/^(['"])(.*)\1$/, '$2').replace(/\s+#.*$/, '').trim();
        if (uri) process.env.MONGODB_URI = uri;
      }
      if (process.env.MONGODB_URI) break;
    }
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Thiếu MONGODB_URI trong môi trường hoặc file .env');
  return uri;
}

function daysAgo(days: number, hour = 10): Date {
  const date = new Date();
  date.setUTCHours(hour, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function vietnamDateKey(date: Date): string {
  const localDate = new Date(date.getTime() + 7 * 60 * 60_000);
  return `${String(localDate.getUTCFullYear()).slice(-2)}${String(localDate.getUTCMonth() + 1).padStart(2, '0')}${String(localDate.getUTCDate()).padStart(2, '0')}`;
}

function addCollection(
  collections: SeedCollection[],
  name: string,
  collection: string,
  idField: string,
  schema: Schema,
  records: SeedRecord[],
): void {
  collections.push({ name, collection, idField, schema, records });
}

function makeCatalog(): { categories: SeedRecord[]; products: SeedProduct[]; productRecords: SeedRecord[] } {
  const categoryNames = ['Rau củ', 'Trái cây', 'Thịt cá', 'Sữa trứng', 'Đồ khô', 'Đồ uống'];
  const namesByCategory = [
    ['Cà chua', 'Rau muống', 'Cải thìa', 'Bắp cải', 'Cà rốt', 'Khoai tây', 'Hành tây', 'Dưa leo', 'Bí đỏ', 'Súp lơ xanh', 'Rau cải ngọt', 'Ớt chuông', 'Nấm đùi gà', 'Xà lách'],
    ['Táo Fuji', 'Chuối già', 'Cam sành', 'Xoài cát', 'Dưa hấu', 'Nho xanh', 'Lê Hàn Quốc', 'Bưởi da xanh', 'Thanh long', 'Dâu tây', 'Bơ sáp', 'Ổi nữ hoàng', 'Đu đủ chín', 'Chanh không hạt'],
    ['Thịt heo ba rọi', 'Thịt bò thăn', 'Ức gà tươi', 'Cá basa phi lê', 'Cá hồi Na Uy', 'Tôm sú tươi', 'Thịt heo xay', 'Sườn non heo', 'Cá thu cắt khúc', 'Đùi gà góc tư', 'Mực ống tươi', 'Bò cuộn lẩu', 'Cá điêu hồng', 'Xúc xích Đức'],
    ['Sữa tươi ít đường', 'Sữa chua có đường', 'Trứng gà ta', 'Phô mai lát', 'Bơ lạt', 'Sữa hạt óc chó', 'Sữa đặc có đường', 'Yaourt nha đam', 'Trứng vịt tươi', 'Kem tươi', 'Sữa tươi không đường', 'Phô mai que', 'Sữa chua uống', 'Trứng cút'],
    ['Gạo thơm ST25', 'Mì gói chua cay', 'Nước mắm cá cơm', 'Dầu ăn thực vật', 'Đường tinh luyện', 'Muối i-ốt', 'Hạt nêm heo', 'Bún khô', 'Miến dong', 'Đậu xanh cà vỏ', 'Yến mạch cán dẹt', 'Mì nui xoắn', 'Tương ớt chai', 'Bột chiên giòn'],
    ['Nước suối tinh khiết', 'Nước cam ép', 'Trà xanh không độ', 'Cà phê sữa lon', 'Nước khoáng có ga', 'Nước dừa tươi', 'Trà đào đóng chai', 'Nước táo ép', 'Sữa bắp chai', 'Nước tăng lực'],
  ];
  const categories = categoryNames.map((categoryName, index) => ({
    categoryId: idFor('category', index + 1),
    categoryName,
    description: `Danh mục ${categoryName.toLowerCase()} tươi ngon mỗi ngày`,
    createdAt: daysAgo(90),
    updatedAt: new Date(),
  }));
  const units = ['kg', 'gói', 'hộp', 'chai'];
  const products: SeedProduct[] = [];
  const productRecords: SeedRecord[] = [];

  namesByCategory.forEach((names, categoryIndex) => {
    names.forEach((productName, itemIndex) => {
      const index = products.length + 1;
      const weighted = categoryIndex === 0 || categoryIndex === 1 || categoryIndex === 2
        ? index % 4 === 0
        : false;
      const unit = weighted ? 'kg' : units[(categoryIndex + itemIndex) % units.length];
      const price = (15 + Math.floor(random() * 185)) * 1000;
      const sale = index % 7 === 0;
      const saleIsExpired = sale && index % 2 === 0;
      const productId = idFor('product', index);
      const saleStartDate = sale ? daysAgo(saleIsExpired ? 20 : 2) : undefined;
      const saleEndDate = sale ? daysAgo(saleIsExpired ? 3 : -5) : undefined;
      const image = [5, 27, 49].includes(index)
        ? (index === 5 ? '' : 'https://example.invalid/muadee-image.jpg')
        : `https://images.example.com/products/${productId}.jpg`;
      products.push({ productId, productName, categoryId: idFor('category', categoryIndex + 1), price, unit, weighted });
      productRecords.push({
        productId,
        productName,
        description: `${productName} được tuyển chọn, bảo quản đúng chuẩn và giao đến tận nhà.`,
        categoryId: idFor('category', categoryIndex + 1),
        price,
        ...(sale ? { salePrice: Math.round(price * 0.85), saleStartDate, saleEndDate } : {}),
        ...(index % 11 === 0 ? { originalPrice: Math.round(price * 1.15), badge: 'Giá tốt' } : {}),
        image,
        unit,
        status: 'ACTIVE',
        avgRating: Number((3.5 + random() * 1.5).toFixed(1)),
        reviewCount: index % 9,
        soldCount: 0,
        searchText: normalizeSearchText(`${productName} ${productName} được tuyển chọn, bảo quản đúng chuẩn và giao đến tận nhà.`),
        createdAt: daysAgo(120 - index),
        updatedAt: new Date(),
      });
    });
  });
  return { categories, products, productRecords };
}

function makeStores(): SeedRecord[] {
  const names = [
    { name: 'Muadee Nguyễn Trãi', address: '120 Nguyễn Trãi, Phường 3, Quận 5, TP. Hồ Chí Minh', district: 'Quận 5' },
    { name: 'Muadee Võ Văn Tần', address: '85 Võ Văn Tần, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh', district: 'Quận 3' },
    { name: 'Muadee Phan Xích Long', address: '210 Phan Xích Long, Phường 2, Phú Nhuận, TP. Hồ Chí Minh', district: 'Phú Nhuận' },
  ];
  return names.map((store, index) => ({
    storeId: idFor('store', index + 1),
    storeName: store.name,
    address: store.address,
    phone: `0287300${String(index + 1).padStart(4, '0')}`,
    status: 'ACTIVE',
    openingHours: {
      monday: { open: '07:00', close: '22:00', closed: false },
      tuesday: { open: '07:00', close: '22:00', closed: false },
      wednesday: { open: '07:00', close: '22:00', closed: false },
      thursday: { open: '07:00', close: '22:00', closed: false },
      friday: { open: '07:00', close: '22:00', closed: false },
      saturday: { open: '07:00', close: '22:00', closed: false },
      sunday: { open: '07:00', close: '22:00', closed: false },
    },
    deliveryZones: [{ district: store.district, wards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4'] }],
    shippingFee: { baseFee: 20000, freeShipThreshold: 300000 },
    createdAt: daysAgo(180),
    updatedAt: new Date(),
  }));
}

export async function seedDatabase(uri = loadMongoUri(), reset = process.argv.includes('--reset')): Promise<void> {
  randomState = SEED;
  const connection = await createConnection(uri).asPromise();
  try {
    const categories: SeedCollection[] = [];
    const { categories: categoryRecords, products, productRecords } = makeCatalog();
    const stores = makeStores();
    const customers: SeedRecord[] = [];
    const users: SeedRecord[] = [];
    const carts: SeedRecord[] = [];
    const memberships: SeedRecord[] = [];
    const employees: SeedRecord[] = [];
    const accountSpecs: SeedAccount[] = [
      { email: 'admin@muadee.vn', name: 'Quản trị viên Muadee', role: 'ADMIN', status: 'ACTIVE' },
      { email: 'staff@muadee.vn', name: 'Nhân viên Muadee', role: 'STAFF', status: 'ACTIVE' },
      { customer: true, email: 'customer@muadee.vn', name: 'Nguyễn Minh Anh', role: 'CUSTOMER', status: 'ACTIVE' },
      { customer: true, email: 'locked@muadee.vn', name: 'Tài khoản bị khóa', role: 'CUSTOMER', status: 'LOCKED' },
    ];
    for (let index = 1; index <= 30; index += 1) {
      accountSpecs.push({
        customer: true,
        email: `khach${String(index).padStart(2, '0')}@muadee.vn`,
        name: `Khách hàng Muadee ${index}`,
        role: 'CUSTOMER',
        status: 'ACTIVE',
      });
    }
    const password = await bcrypt.hash('Muadee123', 10);
    accountSpecs.forEach((account, index) => {
      const userId = idFor('user', index + 1);
      const customerId = account.customer ? idFor('customer', customers.length + 1) : undefined;
      users.push({
        userId,
        fullName: account.name,
        email: account.email,
        phone: `090${String(1000000 + index).slice(-7)}`,
        avatar: '',
        password,
        role: account.role,
        status: account.status,
        refreshTokenHashes: [],
        createdAt: daysAgo(100),
        updatedAt: new Date(),
      });
      if (!customerId) return;
      const isMainCustomer = account.email === 'customer@muadee.vn';
      const addresses = isMainCustomer
        ? [
          { addressId: 'address-main-1', label: 'Nhà riêng', recipientName: account.name, phone: '0901234567', addressLine: '12 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', isDefault: true },
          { addressId: 'address-main-2', label: 'Cơ quan', recipientName: account.name, phone: '0901234567', addressLine: '25 Lê Duẩn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh', isDefault: false },
        ]
        : [{
          addressId: `address-${customerId}`,
          label: 'Nhà riêng',
          recipientName: account.name,
          phone: `090${String(1000000 + index).slice(-7)}`,
          addressLine: `${index + 1} Lê Lợi, Quận 3, TP. Hồ Chí Minh`,
          isDefault: true,
        }];
      customers.push({
        customerId,
        userId,
        address: addresses[0].addressLine,
        addresses,
        createdAt: daysAgo(90),
        updatedAt: new Date(),
      });
      carts.push({
        cartId: idFor('cart', customers.length),
        customerId,
        storeId: idFor('store', 1),
        totalAmount: 0,
        createdAt: daysAgo(30),
        updatedAt: new Date(),
      });
      memberships.push({
        membershipId: idFor('membership', customers.length),
        customerId,
        memberCode: `MD${String(index + 1).padStart(6, '0')}`,
        pointBalance: isMainCustomer ? 2480 : 100 + (index * 17) % 500,
        lifetimePoints: isMainCustomer ? 2480 : 100 + (index * 17) % 500,
        memberLevel: isMainCustomer ? 'Vàng' : 'Thường',
        createdAt: daysAgo(90),
        updatedAt: new Date(),
      });
    });
    employees.push({
      employeeId: idFor('employee', 1),
      userId: idFor('user', 2),
      employeeCode: 'NV0001',
      employeeRole: 'STAFF',
      storeId: idFor('store', 1),
      createdAt: daysAgo(90),
      updatedAt: new Date(),
    });

    const membershipLevels = [
      { name: 'Thường', minPoints: 0, benefits: ['Tích điểm mỗi đơn hàng'], sortOrder: 1 },
      { name: 'Bạc', minPoints: 500, benefits: ['Ưu đãi thành viên bạc'], sortOrder: 2 },
      { name: 'Vàng', minPoints: 1000, benefits: ['Ưu đãi thành viên vàng', 'Tặng điểm sinh nhật'], sortOrder: 3 },
      { name: 'Kim cương', minPoints: 3000, benefits: ['Ưu tiên giao hàng', 'Ưu đãi thành viên cao cấp'], sortOrder: 4 },
    ].map((level, index) => ({ ...level, membershipLevelId: idFor('membershipLevel', index + 1), createdAt: daysAgo(180), updatedAt: new Date() }));
    const statuses = ['PENDING', 'PREPARING', 'READY_FOR_PICKUP', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'RETURNING', 'RETURNED'] as const;
    const paymentMethods = ['CASH', 'TRANSFER', 'CARD'] as const;
    const orderRecords: SeedRecord[] = [];
    const orderItemRecords: SeedRecord[] = [];
    const paymentRecords: SeedRecord[] = [];
    const deliveryRecords: SeedRecord[] = [];
    const pointTransactionRecords: SeedRecord[] = [];
    const salesByStoreAndProduct = new Map<string, number>();
    const reservedByStoreAndProduct = new Map<string, number>();
    const soldCountByProduct = new Map<string, number>();
    const customerPoints = new Map<string, number>();
    for (const membership of memberships) {
      customerPoints.set(String(membership.customerId), Number(membership.pointBalance));
    }
    const counterByDate = new Map<string, number>();
    const reviewCandidates: Array<{ orderId: string; productId: string; customerId: string; index: number }> = [];
    const customerIds = customers.map((customer) => String(customer.customerId));
    const storeIds = stores.map((store) => String(store.storeId));

    for (let index = 0; index < 600; index += 1) {
      const createdAt = daysAgo(index === 0 ? 0 : index % 60, 8 + (index % 12));
      const localDate = new Date(createdAt.getTime() + 7 * 60 * 60_000);
      const weekend = localDate.getUTCDay() === 0 || localDate.getUTCDay() === 6;
      const vegetableSeason = localDate.getUTCMonth() >= 8 && localDate.getUTCMonth() <= 10;
      const dayKey = vietnamDateKey(createdAt);
      const dailySequence = (counterByDate.get(dayKey) ?? 0) + 1;
      counterByDate.set(dayKey, dailySequence);
      const orderId = idFor('order', index + 1);
      const customerId = customerIds[Math.floor(random() * customerIds.length)];
      const storeId = storeIds[index % storeIds.length];
      let orderStatus: typeof statuses[number] = statuses[index % statuses.length];
      let receiveMethod: 'DELIVERY' | 'PICKUP' = index % 2 === 0 ? 'DELIVERY' : 'PICKUP';
      if (orderStatus === 'READY_FOR_PICKUP') receiveMethod = 'PICKUP';
      if (orderStatus === 'SHIPPING') receiveMethod = 'DELIVERY';
      if (orderStatus === 'READY_FOR_PICKUP' && receiveMethod === 'DELIVERY') orderStatus = 'PREPARING';
      const paymentMethod = index === 0 ? 'TRANSFER' : paymentMethods[index % paymentMethods.length];
      const chosenProducts = new Set<number>();
      const itemCount = Math.min(4, 1 + (index % 4) + (weekend ? 1 : 0));
      const localItems: SeedRecord[] = [];
      let subtotal = 0;

      for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
        let productIndex = vegetableSeason && random() < 0.3
          ? Math.floor(random() * 14)
          : Math.floor(random() * products.length);
        while (chosenProducts.has(productIndex)) productIndex = (productIndex + 1) % products.length;
        chosenProducts.add(productIndex);
        const product = products[productIndex];
        const quantity = product.weighted
          ? Number((0.4 + random() * 1.6 * (weekend || (vegetableSeason && product.categoryId === idFor('category', 1)) ? 1.25 : 1)).toFixed(2))
          : 1 + Math.floor(random() * (weekend ? 6 : 4));
        const actualWeight = product.weighted && index % 3 !== 0
          ? Number((quantity * (0.95 + random() * 0.15)).toFixed(2))
          : undefined;
        const discountActive = productIndex % 7 === 6 && index % 2 === 0;
        const unitPrice = discountActive ? Math.round(product.price * 0.85) : product.price;
        const lineTotal = Math.round(unitPrice * (actualWeight ?? quantity));
        subtotal += lineTotal;
        localItems.push({
          orderItemId: idFor('orderItem', index * 4 + itemIndex + 1),
          orderId,
          productId: product.productId,
          productName: product.productName,
          image: productRecords[productIndex].image,
          unit: product.unit,
          unitPrice,
          quantity,
          ...(actualWeight !== undefined ? { actualWeight } : {}),
          lineTotal,
          createdAt,
          updatedAt: createdAt,
        });
        if (!['PENDING', 'CANCELLED'].includes(orderStatus)) {
          const key = `${storeId}\u0000${product.productId}`;
          salesByStoreAndProduct.set(key, (salesByStoreAndProduct.get(key) ?? 0) + quantity);
        }
        if (orderStatus === 'PENDING' && index === 0) {
          const key = `${storeId}\u0000${product.productId}`;
          reservedByStoreAndProduct.set(key, (reservedByStoreAndProduct.get(key) ?? 0) + quantity);
        }
        if (orderStatus === 'DELIVERED') {
          soldCountByProduct.set(product.productId, (soldCountByProduct.get(product.productId) ?? 0) + quantity);
        }
      }
      orderItemRecords.push(...localItems);
      const shippingFee = receiveMethod === 'DELIVERY' ? 20000 : 0;
      const discountAmount = index % 9 === 0 ? Math.round(subtotal * 0.1) : 0;
      const totalAmount = subtotal - discountAmount + shippingFee;
      const paymentStatus = orderStatus === 'CANCELLED' || orderStatus === 'RETURNED'
        ? 'REFUNDED'
        : orderStatus === 'PENDING' && index !== 0 && paymentMethod !== 'CASH'
          ? 'FAILED'
          : orderStatus === 'PENDING' || (paymentMethod === 'CASH' && orderStatus !== 'DELIVERED')
          ? 'PENDING'
          : index % 37 === 0 && paymentMethod !== 'CASH' ? 'FAILED' : 'SUCCESS';
      const statusHistory = [{ status: 'PENDING', at: createdAt, by: 'SYSTEM' }];
      if (orderStatus !== 'PENDING') {
        statusHistory.push({ status: orderStatus, at: new Date(createdAt.getTime() + 15 * 60_000), by: idFor('employee', 1) });
      }
      if (orderStatus === 'RETURNING' || orderStatus === 'RETURNED') {
        statusHistory.splice(1, 0, { status: 'DELIVERED', at: new Date(createdAt.getTime() + 2 * 60 * 60_000), by: 'SYSTEM' });
        if (orderStatus === 'RETURNING') statusHistory[2] = { status: 'RETURNING', at: new Date(createdAt.getTime() + 3 * 60 * 60_000), by: 'SYSTEM' };
        if (orderStatus === 'RETURNED') statusHistory[2] = { status: 'RETURNING', at: new Date(createdAt.getTime() + 3 * 60 * 60_000), by: 'SYSTEM' };
        if (orderStatus === 'RETURNED') statusHistory.push({ status: 'RETURNED', at: new Date(createdAt.getTime() + 4 * 60 * 60_000), by: 'SYSTEM' });
      }
      const orderRecord: SeedRecord = {
        orderId,
        orderCode: `MD${dayKey}${String(dailySequence).padStart(3, '0')}`,
        customerId,
        storeId,
        receiveMethod,
        orderStatus,
        ...(receiveMethod === 'DELIVERY' ? { shippingAddress: '12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh' } : {}),
        recipientName: 'Khách hàng Muadee',
        recipientPhone: '0901234567',
        ...(receiveMethod === 'PICKUP' ? { pickupTime: new Date(createdAt.getTime() + 2 * 60 * 60_000) } : {}),
        ...(index % 5 === 0 ? { note: 'Gọi trước khi giao hàng' } : {}),
        subtotal,
        discountAmount,
        shippingFee,
        totalAmount,
        ...(index % 9 === 0 ? { voucherCode: 'SALE10' } : {}),
        paymentMethod,
        paymentStatus,
        ...(index === 0 ? { idempotencyKey: 'seed-idempotency-key-001' } : {}),
        ...(orderStatus === 'PENDING' && index === 0 ? { reservationExpiresAt: new Date(Date.now() + 15 * 60_000) } : {}),
        ...(orderStatus === 'CANCELLED' ? { cancelReason: 'Khách đổi kế hoạch' } : {}),
        ...(orderStatus === 'RETURNING' || orderStatus === 'RETURNED' ? { returnReason: 'Sản phẩm không đúng mong đợi' } : {}),
        ...(receiveMethod === 'DELIVERY' ? { estimatedDeliveryAt: new Date(createdAt.getTime() + 24 * 60 * 60_000) } : {}),
        statusHistory,
        createdAt,
        updatedAt: createdAt,
      };
      orderRecords.push(orderRecord);

      paymentRecords.push({
        paymentId: idFor('payment', index + 1),
        orderId,
        paymentMethod,
        paymentStatus,
        provider: paymentMethod === 'CASH' ? 'CASH_ON_DELIVERY' : paymentMethod === 'CARD' ? 'DEMO_CARD' : 'DEMO_QR',
        ...(paymentStatus === 'SUCCESS' ? { transactionCode: `TX${String(index + 1).padStart(8, '0')}`, paidAt: new Date(createdAt.getTime() + 20 * 60_000) } : {}),
        amount: totalAmount,
        ...(paymentMethod === 'TRANSFER' ? { transferContent: `MD${dayKey}${String(dailySequence).padStart(3, '0')}` } : {}),
        ...(paymentMethod === 'TRANSFER' && paymentStatus === 'PENDING'
          ? { expiresAt: index === 0 ? new Date(Date.now() + 15 * 60_000) : new Date(createdAt.getTime() + 15 * 60_000) }
          : {}),
        ...(paymentStatus !== 'PENDING' ? { webhookReceivedAt: new Date(createdAt.getTime() + 22 * 60_000) } : {}),
        createdAt,
        updatedAt: createdAt,
      });

      if (receiveMethod === 'DELIVERY' && !['PENDING', 'CANCELLED'].includes(orderStatus)) {
        const deliveryStatus = orderStatus === 'DELIVERED' || orderStatus === 'RETURNING' || orderStatus === 'RETURNED'
          ? 'DELIVERED'
          : orderStatus === 'SHIPPING' ? 'IN_TRANSIT' : index % 11 === 0 ? 'FAILED' : 'WAITING_PICKUP';
        const events = [
          { time: createdAt, status: 'WAITING_PICKUP', location: 'Cửa hàng Muadee' },
          ...(deliveryStatus !== 'WAITING_PICKUP' ? [{ time: new Date(createdAt.getTime() + 60 * 60_000), status: 'IN_TRANSIT', location: 'Trạm trung chuyển' }] : []),
          ...(deliveryStatus === 'DELIVERED' ? [{ time: new Date(createdAt.getTime() + 4 * 60 * 60_000), status: 'DELIVERED', location: 'Địa chỉ nhận hàng' }] : []),
          ...(deliveryStatus === 'FAILED' ? [{ time: new Date(createdAt.getTime() + 4 * 60 * 60_000), status: 'FAILED', location: 'Không liên hệ được người nhận' }] : []),
        ];
        deliveryRecords.push({
          deliveryId: idFor('delivery', index + 1),
          orderId,
          carrierName: index % 2 === 0 ? 'GHN' : 'GHTK',
          trackingCode: `MD${String(index + 1).padStart(10, '0')}`,
          deliveryStatus,
          events,
          estimatedDeliveryAt: new Date(createdAt.getTime() + 24 * 60 * 60_000),
          shippingFee,
          createdAt,
          updatedAt: createdAt,
        });
      }

      if (orderStatus === 'DELIVERED') {
        const earned = Math.floor(totalAmount / 10000);
        const balanceAfter = (customerPoints.get(customerId) ?? 0) + earned;
        customerPoints.set(customerId, balanceAfter);
        pointTransactionRecords.push({
          transactionId: idFor('pointTransaction', index + 1),
          customerId,
          orderId,
          type: 'EARN',
          points: earned,
          balanceAfter,
          note: `Tích điểm đơn hàng ${orderRecord.orderCode}`,
          createdAt: new Date(createdAt.getTime() + 24 * 60 * 60_000),
        });
        if (reviewCandidates.length < 8 && localItems[0]) {
          reviewCandidates.push({ orderId, productId: String(localItems[0].productId), customerId, index });
        }
      }
    }

    const inventoryRecords: SeedRecord[] = [];
    for (const storeId of storeIds) {
      products.forEach((product, index) => {
        const key = `${storeId}\u0000${product.productId}`;
        const sold = Math.ceil(salesByStoreAndProduct.get(key) ?? 0);
        const reserved = Math.ceil(reservedByStoreAndProduct.get(key) ?? 0);
        const desiredAvailable = index % 17 === 0 ? 0 : index % 11 === 0 ? 5 : 20 + Math.floor(random() * 300);
        inventoryRecords.push({
          inventoryId: idFor('inventory', inventoryRecords.length + 1),
          storeId,
          productId: product.productId,
          quantity: sold + reserved + desiredAvailable,
          reservedQuantity: reserved,
          lowStockThreshold: 10,
          createdAt: daysAgo(90),
          updatedAt: new Date(),
        });
      });
    }
    const reviews = reviewCandidates.map((candidate, index) => ({
      reviewId: idFor('review', index + 1),
      customerId: candidate.customerId,
      orderId: candidate.orderId,
      productId: candidate.productId,
      rating: 4 + (index % 2),
      comment: ['Sản phẩm tươi ngon, giao hàng nhanh.', 'Chất lượng tốt, sẽ tiếp tục ủng hộ.', 'Đóng gói cẩn thận, đúng mô tả.'][index % 3],
      isHidden: false,
      createdAt: daysAgo(index + 1),
      updatedAt: daysAgo(index + 1),
    }));
    const ratingsByProduct = new Map<string, number[]>();
    for (const review of reviews) {
      const productId = String(review.productId);
      const ratings = ratingsByProduct.get(productId) ?? [];
      ratings.push(Number(review.rating));
      ratingsByProduct.set(productId, ratings);
    }
    for (const record of productRecords) {
      const ratings = ratingsByProduct.get(String(record.productId)) ?? [];
      record.soldCount = Math.round(soldCountByProduct.get(String(record.productId)) ?? 0);
      record.reviewCount = ratings.length;
      if (ratings.length > 0) record.avgRating = Number((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1));
    }

    for (const membership of memberships) {
      const customerId = String(membership.customerId);
      if (customerPoints.has(customerId)) {
        membership.pointBalance = customerPoints.get(customerId)!;
        membership.lifetimePoints = Math.max(Number(membership.lifetimePoints), Number(membership.pointBalance));
      }
    }

    const now = new Date();
    const vouchers = [
      { code: 'SALE10', description: 'Giảm 10% cho đơn hàng', discountValue: 10, discountType: 'PERCENT', minOrderAmount: 100000, maxDiscountAmount: 50000, startDate: daysAgo(5), endDate: daysAgo(-20), usageLimit: 1000, usedCount: 120, status: 'ACTIVE' },
      { code: 'HOMNAY20', description: 'Giảm 20.000đ đơn từ 200.000đ', discountValue: 20000, discountType: 'FIXED', minOrderAmount: 200000, startDate: daysAgo(2), endDate: new Date(now.getTime() + 24 * 60 * 60_000), usageLimit: 200, usedCount: 45, status: 'ACTIVE' },
      { code: 'THANHVIEN', description: 'Ưu đãi dành cho thành viên', discountValue: 15, discountType: 'PERCENT', minOrderAmount: 150000, maxDiscountAmount: 60000, startDate: daysAgo(10), endDate: daysAgo(-30), usageLimit: 500, usedCount: 88, status: 'ACTIVE' },
      { code: 'SAPHETHAN', description: 'Ưu đãi sắp hết hạn', discountValue: 15000, discountType: 'FIXED', minOrderAmount: 100000, startDate: daysAgo(4), endDate: new Date(now.getTime() + 3 * 24 * 60 * 60_000), usageLimit: 100, usedCount: 24, status: 'ACTIVE' },
      { code: 'HETHAN', description: 'Mã ưu đãi đã hết hạn', discountValue: 10, discountType: 'PERCENT', minOrderAmount: 100000, startDate: daysAgo(40), endDate: daysAgo(10), usageLimit: 100, usedCount: 100, status: 'INACTIVE' },
    ].map((voucher, index) => ({ ...voucher, voucherId: idFor('voucher', index + 1), createdAt: daysAgo(30), updatedAt: new Date() }));

    const knowledgeRecords = Array.from({ length: 30 }, (_, index) => {
      const topics = ['Câu hỏi thường gặp', 'Chính sách giao nhận', 'Chính sách đổi trả', 'Khuyến mãi'];
      const topic = topics[index % topics.length];
      return {
        knowledgeId: idFor('knowledge', index + 1),
        title: `${topic} Muadee ${index + 1}`,
        content: `Muadee luôn hỗ trợ khách hàng. ${topic}: đơn hàng được xử lý tại cửa hàng gần nhất; khách có thể liên hệ chăm sóc khách hàng để được hướng dẫn chi tiết.`,
        docType: ['FAQ', 'SHIPPING_POLICY', 'RETURN_POLICY', 'PROMOTION'][index % 4],
        status: 'ACTIVE',
        embedding: [],
        createdAt: daysAgo(60 - index),
        updatedAt: new Date(),
      };
    });
    const aiConfigs = [
      { featureKey: 'CHATBOT', enabled: true, modelName: 'default-chat-model', parameters: { temperature: 0.2, maxTokens: 1024 } },
      { featureKey: 'RECOMMENDATION', enabled: true, modelName: 'hybrid-recommendation', parameters: { limit: 8 } },
      { featureKey: 'FORECAST', enabled: true, modelName: 'seasonal-forecast', parameters: { periodDays: 7 } },
    ].map((config, index) => ({ ...config, configId: idFor('aiConfig', index + 1), createdAt: daysAgo(30), updatedAt: new Date() }));
    const demandForecasts = Array.from({ length: 30 }, (_, index) => ({
      forecastId: idFor('forecast', index + 1),
      storeId: storeIds[index % storeIds.length],
      productId: products[(index * 7) % products.length].productId,
      periodStart: daysAgo(index % 7),
      predictedQuantity: 10 + Math.floor(random() * 80),
      alertType: index % 5 === 0 ? 'SHORTAGE' : index % 7 === 0 ? 'OVERSTOCK' : 'NORMAL',
      decisionStatus: 'PENDING',
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    }));
    const activityRecords = Array.from({ length: 20 }, (_, index) => ({
      activityId: idFor('activity', index + 1),
      ...(index % 2 === 0 ? { customerId: customerIds[index % customerIds.length] } : { anonymousId: `guest-${index + 1}` }),
      productId: products[index % products.length].productId,
      activityType: index % 3 === 0 ? 'VIEW' : index % 3 === 1 ? 'ADD_TO_CART' : 'SEARCH',
      ...(index % 3 === 2 ? { searchQuery: products[index % products.length].productName } : {}),
      createdAt: daysAgo(index % 30),
    }));
    const aiFeedback = Array.from({ length: 10 }, (_, index) => ({
      feedbackId: idFor('aiFeedback', index + 1),
      customerId: customerIds[index % customerIds.length],
      feedbackType: index % 2 === 0 ? 'CHATBOT' : 'RECOMMENDATION',
      ...(index % 2 === 0 ? { messageId: `message-${index + 1}` } : { productId: products[index].productId }),
      isHelpful: index % 3 !== 0,
      comment: index % 3 === 0 ? 'Cần thêm thông tin chi tiết.' : 'Thông tin hữu ích.',
      createdAt: daysAgo(index % 20),
      updatedAt: daysAgo(index % 20),
    }));
    const counterRecords = [...counterByDate.entries()].map(([date, seq], index) => ({
      counterId: idFor('counter', index + 1),
      counterKey: `order-${date}`,
      seq,
      createdAt: daysAgo(60),
      updatedAt: new Date(),
    }));

    addCollection(categories, 'AIFeedback', 'aifeedbacks', 'feedbackId', AIFeedbackSchema, aiFeedback);
    addCollection(categories, 'AIConfig', 'aiconfigs', 'configId', AIConfigSchema, aiConfigs);
    addCollection(categories, 'Cart', 'carts', 'cartId', CartSchema, carts);
    addCollection(categories, 'CartItem', 'cartitems', 'itemId', CartItemSchema, []);
    addCollection(categories, 'Category', 'categories', 'categoryId', CategorySchema, categoryRecords);
    addCollection(categories, 'ChatMessage', 'chatmessages', 'messageId', ChatMessageSchema, []);
    addCollection(categories, 'ChatSession', 'chatsessions', 'sessionId', ChatSessionSchema, []);
    addCollection(categories, 'Counter', 'counters', 'counterId', CounterSchema, counterRecords);
    addCollection(categories, 'Customer', 'customers', 'customerId', CustomerSchema, customers);
    addCollection(categories, 'Delivery', 'deliveries', 'deliveryId', DeliverySchema, deliveryRecords);
    addCollection(categories, 'DemandForecast', 'demandforecasts', 'forecastId', DemandForecastSchema, demandForecasts);
    addCollection(categories, 'Employee', 'employees', 'employeeId', EmployeeSchema, employees);
    addCollection(categories, 'Inventory', 'inventories', 'inventoryId', InventorySchema, inventoryRecords);
    addCollection(categories, 'KnowledgeDocument', 'knowledgedocuments', 'knowledgeId', KnowledgeDocumentSchema, knowledgeRecords);
    addCollection(categories, 'Membership', 'memberships', 'membershipId', MembershipSchema, memberships);
    addCollection(categories, 'MembershipLevel', 'membershiplevels', 'membershipLevelId', MembershipLevelSchema, membershipLevels);
    addCollection(categories, 'Order', 'orders', 'orderId', OrderSchema, orderRecords);
    addCollection(categories, 'OrderItem', 'orderitems', 'orderItemId', OrderItemSchema, orderItemRecords);
    addCollection(categories, 'Payment', 'payments', 'paymentId', PaymentSchema, paymentRecords);
    addCollection(categories, 'PointTransaction', 'pointtransactions', 'transactionId', PointTransactionSchema, pointTransactionRecords);
    addCollection(categories, 'Product', 'products', 'productId', ProductSchema, productRecords);
    addCollection(categories, 'Review', 'reviews', 'reviewId', ReviewSchema, reviews);
    addCollection(categories, 'Store', 'stores', 'storeId', StoreSchema, stores);
    addCollection(categories, 'User', 'users', 'userId', UserSchema, users);
    addCollection(categories, 'UserActivity', 'useractivities', 'activityId', UserActivitySchema, activityRecords);
    addCollection(categories, 'Voucher', 'vouchers', 'voucherId', VoucherSchema, vouchers);

    for (const entry of categories) {
      for (const document of entry.records) {
        const id = document[entry.idField];
        if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
          throw new Error(`${entry.name}.${entry.idField} cần là chuỗi ObjectId hợp lệ`);
        }
        document._id = new Types.ObjectId(id);
      }
    }

    if (reset) {
      for (const entry of categories) {
        await connection.collection(entry.collection).deleteMany({});
      }
    }
    for (const entry of categories) {
      connection.model<SeedRecord>(entry.name, entry.schema, entry.collection);
      const collection = connection.collection(entry.collection);
      if (entry.records.length > 0) {
        const operations = entry.records.map((document) => ({
          replaceOne: {
            filter: { [entry.idField]: document[entry.idField] },
            replacement: document,
            upsert: true,
          },
        }));
        await collection.bulkWrite(operations, { ordered: false });
      }
      console.info(`${entry.name}: ${await collection.countDocuments()}`);
    }

    console.info(`Seed hoàn tất (${reset ? 'reset' : 'upsert'}, seed=${SEED}):`);
    for (const entry of categories) {
      console.info(`- ${entry.name}: ${entry.records.length}`);
    }
  } finally {
    await connection.close();
  }
}

if (require.main === module) {
  void seedDatabase().catch((error: unknown) => {
    console.error('Không thể tạo dữ liệu seed:', error);
    process.exitCode = 1;
  });
}
