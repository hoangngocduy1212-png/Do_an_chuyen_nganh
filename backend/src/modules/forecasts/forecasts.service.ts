import { BadGatewayException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiClientService } from '../ai-client/ai-client.service';
import { Product } from '../products/schemas/product.schema';

@Injectable()
export class ForecastsService {
  constructor(
    private readonly ai: AiClientService,
    @InjectModel(Product.name) private readonly products: Model<Product>,
  ) {}

  async run(storeId: string, periodDays: number) {
    let results;
    try {
      ({ results } = await this.ai.forecast({ storeId, periodDays }));
    } catch {
      throw new BadGatewayException('Dịch vụ AI dự báo chưa sẵn sàng. Hãy kiểm tra ai-service (cổng 8000).');
    }
    const rows = await this.products.find({ productId: { $in: results.map((r) => r.productId) } }, { productId: 1, productName: 1, unit: 1 }).lean();
    const byId = new Map(rows.map((p) => [p.productId, p]));
    return results.map((r) => ({
      ...r,
      productName: byId.get(r.productId)?.productName ?? r.productId,
      unit: byId.get(r.productId)?.unit ?? '',
    }));
  }
}
