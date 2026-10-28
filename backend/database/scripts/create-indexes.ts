import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createConnection, Schema } from 'mongoose';
import { AIFeedbackSchema } from '../../src/modules/ai-feedback/schemas/ai-feedback.schema';
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

interface SchemaCollection {
  name: string;
  collection: string;
  schema: Schema;
}

const schemas: SchemaCollection[] = [
  { name: 'AIFeedback', collection: 'aifeedbacks', schema: AIFeedbackSchema },
  { name: 'AIConfig', collection: 'aiconfigs', schema: AIConfigSchema },
  { name: 'Cart', collection: 'carts', schema: CartSchema },
  { name: 'CartItem', collection: 'cartitems', schema: CartItemSchema },
  { name: 'Category', collection: 'categories', schema: CategorySchema },
  { name: 'ChatMessage', collection: 'chatmessages', schema: ChatMessageSchema },
  { name: 'ChatSession', collection: 'chatsessions', schema: ChatSessionSchema },
  { name: 'Counter', collection: 'counters', schema: CounterSchema },
  { name: 'Customer', collection: 'customers', schema: CustomerSchema },
  { name: 'Delivery', collection: 'deliveries', schema: DeliverySchema },
  { name: 'DemandForecast', collection: 'demandforecasts', schema: DemandForecastSchema },
  { name: 'Employee', collection: 'employees', schema: EmployeeSchema },
  { name: 'Inventory', collection: 'inventories', schema: InventorySchema },
  { name: 'KnowledgeDocument', collection: 'knowledgedocuments', schema: KnowledgeDocumentSchema },
  { name: 'Membership', collection: 'memberships', schema: MembershipSchema },
  { name: 'MembershipLevel', collection: 'membershiplevels', schema: MembershipLevelSchema },
  { name: 'OrderItem', collection: 'orderitems', schema: OrderItemSchema },
  { name: 'Order', collection: 'orders', schema: OrderSchema },
  { name: 'Payment', collection: 'payments', schema: PaymentSchema },
  { name: 'PointTransaction', collection: 'pointtransactions', schema: PointTransactionSchema },
  { name: 'Product', collection: 'products', schema: ProductSchema },
  { name: 'Review', collection: 'reviews', schema: ReviewSchema },
  { name: 'Store', collection: 'stores', schema: StoreSchema },
  { name: 'User', collection: 'users', schema: UserSchema },
  { name: 'UserActivity', collection: 'useractivities', schema: UserActivitySchema },
  { name: 'Voucher', collection: 'vouchers', schema: VoucherSchema },
];

function loadMongoUriFromEnvFiles(): void {
  if (process.env.MONGODB_URI) return;

  const envFiles = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '..', '.env')];
  for (const envFile of envFiles) {
    if (!existsSync(envFile)) continue;
    for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?MONGODB_URI\s*=\s*(.*?)\s*$/);
      if (!match) continue;

      let uri = match[1];
      if ((uri.startsWith('"') && uri.endsWith('"')) || (uri.startsWith("'") && uri.endsWith("'"))) {
        uri = uri.slice(1, -1);
      } else {
        uri = uri.replace(/\s+#.*$/, '').trim();
      }
      if (uri) {
        process.env.MONGODB_URI = uri;
        return;
      }
    }
  }
}

export async function createIndexes(configuredUri?: string): Promise<void> {
  if (!configuredUri) loadMongoUriFromEnvFiles();
  const uri = configuredUri ?? process.env.MONGODB_URI;
  if (!uri) throw new Error('Thiếu biến môi trường MONGODB_URI');

  const connection = await createConnection(uri).asPromise();
  try {
    for (const entry of schemas) {
      const model = connection.model<Record<string, unknown>>(entry.name, entry.schema, entry.collection);
      await model.createIndexes();
      console.info(`Đã đảm bảo indexes: ${entry.name}`);
    }
  } finally {
    await connection.close();
  }
}

if (require.main === module) {
  void createIndexes().catch((error: unknown) => {
    console.error('Không thể tạo indexes MongoDB:', error);
    process.exitCode = 1;
  });
}
