import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { ErrorCode } from '../../common/constants/error-codes';
import { Category } from '../categories/schemas/category.schema';
import { Inventory } from '../inventory/schemas/inventory.schema';
import { Order } from '../orders/schemas/order.schema';
import { OrderItem } from '../order-items/schemas/order-item.schema';
import { CreateProductDto, ProductQueryDto, UpdateProductDto } from './dto/product.dto';
import { Product } from './schemas/product.schema';

interface BestsellerEntry {
  expiresAt: number;
  soldById: Map<string, number>;
}

type ProductView = Record<string, unknown> & { productId: string; stock?: number; soldCount: number };

@Injectable()
export class ProductsService {
  private readonly bestsellerCache = new Map<string, BestsellerEntry>();

  constructor(
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(Category.name) private readonly categories: Model<Category>,
    @InjectModel(Inventory.name) private readonly inventory: Model<Inventory>,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(OrderItem.name) private readonly orderItems: Model<OrderItem>,
  ) {}

  async findAll(query: ProductQueryDto) {
    const now = new Date();
    const bestseller = query.collection === 'bestseller' ? await this.getBestsellers(query.storeId) : undefined;
    const pipeline: PipelineStage[] = [
      { $match: { status: 'ACTIVE', ...(query.categoryId ? { categoryId: query.categoryId } : {}) } },
      {
        $addFields: {
          _saleActive: {
            $and: [
              { $gt: ['$salePrice', 0] },
              { $lte: ['$saleStartDate', now] },
              { $gte: ['$saleEndDate', now] },
            ],
          },
        },
      },
      { $addFields: { _effectivePrice: { $cond: ['$_saleActive', '$salePrice', '$price'] } } },
    ];

    const conditions: Record<string, unknown>[] = [];
    if (query.q?.trim()) {
      const search = normalize(query.q.trim()).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      conditions.push({ searchText: { $regex: search, $options: 'i' } });
    }
    if (query.minPrice !== undefined) conditions.push({ _effectivePrice: { $gte: query.minPrice } });
    if (query.maxPrice !== undefined) conditions.push({ _effectivePrice: { $lte: query.maxPrice } });
    if (query.collection === 'deals') conditions.push({ _saleActive: true });

    let stockByProduct = new Map<string, number>();
    if (query.storeId) {
      const rows = await this.inventory.find({ storeId: query.storeId }).select('productId quantity reservedQuantity').lean().exec();
      stockByProduct = new Map(rows.map((row) => [row.productId, Math.max(0, row.quantity - (row.reservedQuantity ?? 0))]));
    }
    if (query.inStock && !query.storeId) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'storeId là bắt buộc khi lọc theo tồn kho' });
    }
    if (query.inStock) {
      const inStockIds = [...stockByProduct].filter(([, stock]) => stock > 0).map(([productId]) => productId);
      conditions.push({ productId: { $in: inStockIds } });
    }
    if (conditions.length) pipeline.push({ $match: { $and: conditions } });
    if (bestseller) {
      pipeline.push({
        $addFields: {
          _recentSold: {
            $switch: {
              branches: [...bestseller].map(([id, sold]) => ({
                case: {
                  $or: [
                    { $eq: ['$productId', id] },
                    { $eq: [{ $toString: '$_id' }, id] },
                  ],
                },
                then: sold,
              })),
              default: 0,
            },
          },
        },
      });
    }

    const sort: Record<string, 1 | -1> = query.collection === 'bestseller'
      ? { _recentSold: -1 }
      : query.sort === 'price' ? { _effectivePrice: 1 }
        : query.sort === '-price' ? { _effectivePrice: -1 }
          : query.sort === '-discount' ? { _discount: -1 }
            : query.sort === '-sold' ? { soldCount: -1 }
              : { createdAt: -1 };

    const [result] = await this.products.aggregate<{
      products: Array<Record<string, unknown>>;
      count: Array<{ total: number }>;
    }>([
      ...pipeline,
      {
        $addFields: {
          salePrice: { $cond: ['$_saleActive', '$salePrice', '$$REMOVE'] },
          _discount: { $cond: ['$_saleActive', { $subtract: ['$price', '$salePrice'] }, 0] },
        },
      },
      {
        $facet: {
          products: [
            { $sort: sort },
            { $skip: (query.page - 1) * query.limit },
            { $limit: query.limit },
          ],
          count: [{ $count: 'total' }],
        },
      },
    ]).exec();
    const productRows: Array<Record<string, unknown>> = result?.products ?? [];
    const total = result?.count?.[0]?.total ?? 0;
    const categoryIds = [...new Set(productRows.map((row: Record<string, unknown>) => String(row.categoryId)))];
    const categories = await this.categories.find({ categoryId: { $in: categoryIds } }).select('categoryId categoryName').exec();
    const categoryNames = new Map(categories.map((category) => [category.categoryId, category.categoryName]));

    let items: ProductView[] = productRows.map((row) => {
      const id = String(row.productId ?? row._id);
      const view: ProductView = {
        ...row,
        _id: id,
        productId: id,
        name: row.productName,
        imageUrl: row.image,
        categoryName: categoryNames.get(String(row.categoryId)) ?? '',
        avgRating: Number(row.avgRating ?? 0),
        reviewCount: Number(row.reviewCount ?? 0),
        soldCount: bestseller?.get(id) ?? Number(row.soldCount ?? 0),
      };
      delete view._saleActive;
      delete view._effectivePrice;
      delete view._discount;
      delete view._recentSold;
      delete view.searchText;
      if (query.storeId) view.stock = stockByProduct.get(id) ?? 0;
      return view;
    });
    if (query.sort === '-sold') {
      items = items.sort((left, right) => (right.soldCount ?? 0) - (left.soldCount ?? 0));
    }
    return { data: items, meta: { page: query.page, limit: query.limit, total } };
  }

  async findOne(id: string, storeId?: string) {
    const product = await this.products.findOne({ productId: id }).exec();
    if (!product || product.status !== 'ACTIVE') {
      throw new NotFoundException({ code: ErrorCode.PRODUCT_NOT_FOUND, message: 'Không tìm thấy sản phẩm đang bán' });
    }
    const category = await this.categories.findOne({ categoryId: product.categoryId }).select('categoryName').exec();
    const stock = storeId ? await this.getStock(storeId, id) : undefined;
    const value = product.toJSON() as Record<string, unknown>;
    return {
      ...value,
      name: product.productName,
      imageUrl: product.image,
      categoryName: category?.categoryName ?? '',
      ...(stock === undefined ? {} : { stock }),
      salePrice: this.saleIsActive(product) ? product.salePrice : undefined,
    };
  }

  create(dto: CreateProductDto) {
    return this.products.create(dto);
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.products.findOne({ productId: id }).exec();
    if (!product) throw new NotFoundException({ code: ErrorCode.PRODUCT_NOT_FOUND, message: 'Không tìm thấy sản phẩm' });
    Object.assign(product, dto);
    await product.save();
    return product;
  }

  private async getStock(storeId: string, productId: string): Promise<number> {
    const stock = await this.inventory.findOne({ storeId, productId }).select('quantity reservedQuantity').lean().exec();
    return stock ? Math.max(0, stock.quantity - (stock.reservedQuantity ?? 0)) : 0;
  }

  private saleIsActive(product: Product): boolean {
    const now = new Date();
    return typeof product.salePrice === 'number' && Boolean(product.saleStartDate && product.saleEndDate)
      && product.saleStartDate! <= now && product.saleEndDate! >= now;
  }

  private async getBestsellers(storeId?: string): Promise<Map<string, number>> {
    const key = storeId ?? '*';
    const now = Date.now();
    const cached = this.bestsellerCache.get(key);
    if (cached && cached.expiresAt > now) return cached.soldById;

    const cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const rows = await this.orderItems.aggregate([
      {
        $lookup: {
          from: this.orders.collection.name,
          let: { orderId: '$orderId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$orderId', '$$orderId'] },
                    { $eq: [{ $toString: '$_id' }, '$$orderId'] },
                  ],
                },
              },
            },
            { $match: { orderStatus: 'DELIVERED', createdAt: { $gte: cutoff }, ...(storeId ? { storeId } : {}) } },
            { $project: { _id: 1 } },
          ],
          as: 'order',
        },
      },
      { $unwind: '$order' },
      { $group: { _id: '$productId', sold: { $sum: '$quantity' } } },
      { $sort: { sold: -1 } },
    ]).exec();
    const soldById = new Map<string, number>(rows.map((row: { _id: string; sold: number }) => [row._id, row.sold]));
    this.bestsellerCache.set(key, { expiresAt: now + 10 * 60 * 1000, soldById });
    return soldById;
  }
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
}
