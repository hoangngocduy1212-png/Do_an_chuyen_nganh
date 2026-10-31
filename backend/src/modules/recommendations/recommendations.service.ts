import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/constants/roles';
import { AiClientService } from '../ai-client/ai-client.service';
import { Category } from '../categories/schemas/category.schema';
import { Customer } from '../customers/schemas/customer.schema';
import { Inventory } from '../inventory/schemas/inventory.schema';
import { Product } from '../products/schemas/product.schema';

const LIMIT = 8;

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    private readonly ai: AiClientService,
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(Category.name) private readonly categories: Model<Category>,
    @InjectModel(Inventory.name) private readonly inventory: Model<Inventory>,
    @InjectModel(Customer.name) private readonly customers: Model<Customer>,
  ) {}

  async recommend(placement: 'home' | 'product' | 'cart', storeId: string, productId: string | undefined, user?: AuthUser) {
    const customer = user?.role === Role.CUSTOMER
      ? await this.customers.findOne({ userId: user.userId }).select('customerId').lean().exec()
      : null;
    const bestSellerItems = await this.bestSellers(storeId);

    try {
      const result = await this.ai.recommend({ customerId: customer?.customerId, placement, productId, storeId, limit: LIMIT });
      const items = await this.hydrate(result.items.map((item) => item.productId), storeId);
      if (items.length) {
        const coldStart = !customer || result.strategy.toLowerCase().includes('cold');
        return { items, personalizedItems: coldStart ? [] : items, bestSellerItems, coldStart, strategy: result.strategy };
      }
    } catch (error) {
      this.logger.warn(`Recommendation fallback: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { items: bestSellerItems, personalizedItems: [], bestSellerItems, coldStart: true, strategy: 'best-seller-fallback' };
  }

  private async bestSellers(storeId: string) {
    const stocked = await this.inventory.find({ storeId, quantity: { $gt: 0 } }).select('productId').lean().exec();
    const rows = await this.products
      .find({ status: 'ACTIVE', productId: { $in: stocked.map((row) => row.productId) } })
      .sort({ soldCount: -1 })
      .limit(LIMIT)
      .select('productId')
      .lean()
      .exec();
    return this.hydrate(rows.map((row) => row.productId), storeId);
  }

  async hydrate(productIds: string[], storeId: string) {
    if (!productIds.length) return [];
    const [products, stock] = await Promise.all([
      this.products.find({ productId: { $in: productIds }, status: 'ACTIVE' }).exec(),
      this.inventory.find({ storeId, productId: { $in: productIds } }).select('productId quantity reservedQuantity').lean().exec(),
    ]);
    const categories = await this.categories.find({ categoryId: { $in: products.map((product) => product.categoryId) } }).select('categoryId categoryName').lean().exec();
    const stockById = new Map(stock.map((row) => [row.productId, Math.max(0, row.quantity - (row.reservedQuantity ?? 0))]));
    const byId = new Map(products.map((product) => [product.productId, product]));
    const now = new Date();
    return productIds.flatMap((id) => {
      const product = byId.get(id);
      if (!product) return [];
      const saleActive = typeof product.salePrice === 'number' && !!product.saleStartDate && !!product.saleEndDate
        && product.saleStartDate <= now && product.saleEndDate >= now;
      return [{
        ...(product.toJSON() as Record<string, unknown>),
        name: product.productName,
        imageUrl: product.image,
        categoryName: categories.find((category) => category.categoryId === product.categoryId)?.categoryName ?? '',
        salePrice: saleActive ? product.salePrice : undefined,
        stock: stockById.get(id) ?? 0,
      }];
    });
  }
}
