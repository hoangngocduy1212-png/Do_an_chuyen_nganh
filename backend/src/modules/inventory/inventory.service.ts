import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { Inventory } from './schemas/inventory.schema';
import { InventoryQueryDto, InventoryChangeDto } from './dto/inventory.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/constants/roles';
import { ErrorCode } from '../../common/constants/error-codes';

export interface InventoryRequest {
  storeId: string;
  productId: string;
  quantity: number;
}

export interface MissingInventoryItem extends InventoryRequest {
  available: number;
}

@Injectable()
export class InventoryService {
  constructor(@InjectModel(Inventory.name) private readonly inventoryModel: Model<Inventory>) {}

  async list(query: InventoryQueryDto, user: AuthUser) {
    const filter: Record<string, unknown> = {};
    if (user.role === Role.STAFF) {
      if (!user.storeId) throw new NotFoundException('Không tìm thấy cửa hàng của nhân viên');
      filter.storeId = user.storeId;
    } else if (query.storeId) filter.storeId = query.storeId;
    if (query.productId) filter.productId = query.productId;
    if (query.lowStock) {
      filter.$expr = {
        $lte: [{ $subtract: ['$quantity', { $ifNull: ['$reservedQuantity', 0] }] }, '$lowStockThreshold'],
      };
    }
    return this.inventoryModel.find(filter).sort({ storeId: 1, productId: 1 }).exec();
  }

  async change(dto: InventoryChangeDto, operation: 'import' | 'export') {
    if (operation === 'import') {
      const inventory = await this.inventoryModel.findOneAndUpdate(
        { storeId: dto.storeId, productId: dto.productId },
        { $inc: { quantity: dto.quantity }, $setOnInsert: { reservedQuantity: 0 } },
        { upsert: true, new: true, runValidators: true },
      ).exec();
      return inventory;
    }

    const inventory = await this.inventoryModel.findOneAndUpdate(
      {
        storeId: dto.storeId,
        productId: dto.productId,
        $expr: {
          $gte: [
            { $subtract: ['$quantity', { $ifNull: ['$reservedQuantity', 0] }] },
            dto.quantity,
          ],
        },
      },
      { $inc: { quantity: -dto.quantity } },
      { new: true, runValidators: true },
    ).exec();
    if (!inventory) {
      throw new ConflictException({
        code: ErrorCode.OUT_OF_STOCK,
        message: 'Số lượng xuất vượt quá tồn kho khả dụng',
      });
    }
    return inventory;
  }

  async reserve(items: InventoryRequest[], session: ClientSession): Promise<void> {
    const requests = this.aggregate(items);
    const reserved: InventoryRequest[] = [];
    const missing: MissingInventoryItem[] = [];

    for (const item of requests) {
      const result = await this.inventoryModel.updateOne(
        {
          storeId: item.storeId,
          productId: item.productId,
          $expr: {
            $gte: [
              { $subtract: ['$quantity', { $ifNull: ['$reservedQuantity', 0] }] },
              item.quantity,
            ],
          },
        },
        { $inc: { reservedQuantity: item.quantity } },
        { session },
      ).exec();

      if (result.matchedCount === 1) {
        reserved.push(item);
        continue;
      }

      const inventory = await this.inventoryModel.findOne({
        storeId: item.storeId,
        productId: item.productId,
      }).session(session).select('quantity reservedQuantity').lean().exec();
      const available = inventory ? Math.max(0, inventory.quantity - (inventory.reservedQuantity ?? 0)) : 0;
      missing.push({ ...item, available });
    }

    if (missing.length > 0) {
      for (const item of reserved) await this.decreaseReserved(item, session);
      throw new ConflictException({
        code: 'OUT_OF_STOCK',
        message: 'Một hoặc nhiều sản phẩm không đủ tồn kho',
        missing,
      });
    }
  }

  async release(items: InventoryRequest[], session: ClientSession): Promise<void> {
    for (const item of this.aggregate(items)) {
      const result = await this.inventoryModel.updateOne(
        {
          storeId: item.storeId,
          productId: item.productId,
          reservedQuantity: { $gte: item.quantity },
        },
        { $inc: { reservedQuantity: -item.quantity } },
        { session },
      ).exec();
      if (result.matchedCount !== 1) {
        throw new ConflictException({
          code: 'INVENTORY_RESERVATION_MISMATCH',
          message: `Không tìm thấy lượng tồn đã giữ cho sản phẩm ${item.productId}`,
        });
      }
    }
  }

  async commit(items: InventoryRequest[], session: ClientSession): Promise<void> {
    for (const item of this.aggregate(items)) {
      const result = await this.inventoryModel.updateOne(
        {
          storeId: item.storeId,
          productId: item.productId,
          quantity: { $gte: item.quantity },
          reservedQuantity: { $gte: item.quantity },
        },
        { $inc: { quantity: -item.quantity, reservedQuantity: -item.quantity } },
        { session },
      ).exec();
      if (result.matchedCount !== 1) {
        throw new ConflictException({
          code: 'INVENTORY_RESERVATION_MISMATCH',
          message: `Không thể chốt lượng tồn đã giữ cho sản phẩm ${item.productId}`,
        });
      }
    }
  }

  private async decreaseReserved(item: InventoryRequest, session: ClientSession): Promise<void> {
    const result = await this.inventoryModel.updateOne(
      { storeId: item.storeId, productId: item.productId, reservedQuantity: { $gte: item.quantity } },
      { $inc: { reservedQuantity: -item.quantity } },
      { session },
    ).exec();
    if (result.matchedCount !== 1) {
      throw new NotFoundException(`Không thể hoàn tác lượng tồn đã giữ cho sản phẩm ${item.productId}`);
    }
  }

  private aggregate(items: InventoryRequest[]): InventoryRequest[] {
    const grouped = new Map<string, InventoryRequest>();
    for (const item of items) {
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        throw new ConflictException({ code: 'INVALID_QUANTITY', message: 'Số lượng đặt phải lớn hơn 0' });
      }
      const key = `${item.storeId}\u0000${item.productId}`;
      const existing = grouped.get(key);
      if (existing) existing.quantity += item.quantity;
      else grouped.set(key, { ...item });
    }
    return [...grouped.values()];
  }
}
