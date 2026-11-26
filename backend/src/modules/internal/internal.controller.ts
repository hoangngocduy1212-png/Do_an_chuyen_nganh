import { Controller, Get, Headers, Query, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Public } from '../../common/decorators/public.decorator';
import { Inventory } from '../inventory/schemas/inventory.schema';
import { Product } from '../products/schemas/product.schema';

@Controller('internal')
export class InternalController {
  constructor(
    private readonly config: ConfigService,
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(Inventory.name) private readonly inventory: Model<Inventory>,
  ) {}

  /** API nội bộ cho ai-service: trả giá + tồn kho thật theo cửa hàng. */
  @Public()
  @Get('products')
  async getProducts(
    @Headers('x-service-token') token: string | undefined,
    @Query('ids') ids?: string,
    @Query('storeId') storeId?: string,
  ) {
    const expected = this.config.get<string>('ai.internalKey') ?? '';
    if (!expected || token !== expected || !token) {
      throw new UnauthorizedException('Invalid service token');
    }
    const idList = (ids ?? '').split(',').map((id) => id.trim()).filter(Boolean).slice(0, 100);
    if (!idList.length) return [];

    const [products, stockRows] = await Promise.all([
      this.products.find({ productId: { $in: idList }, status: 'ACTIVE' }).lean().exec(),
      storeId
        ? this.inventory.find({ storeId, productId: { $in: idList } }).select('productId quantity reservedQuantity').lean().exec()
        : Promise.resolve([]),
    ]);
    const stockById = new Map(stockRows.map((row) => [row.productId, Math.max(0, row.quantity - (row.reservedQuantity ?? 0))]));

    return products.map((product) => ({
      ...product,
      productId: product.productId,
      id: product.productId,
      name: product.productName,
      price: product.price,
      unit: product.unit,
      image: product.image,
      stock: storeId ? (stockById.get(product.productId) ?? 0) : null,
      available: storeId ? (stockById.get(product.productId) ?? 0) > 0 : null,
    }));
  }
}
