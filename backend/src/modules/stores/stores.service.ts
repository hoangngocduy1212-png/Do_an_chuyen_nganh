import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { getBusinessRules } from '../../common/constants/business-rules';
import { ErrorCode } from '../../common/constants/error-codes';
import { CreateStoreDto, UpdateStoreDto } from './dto/store.dto';
import { Store } from './schemas/store.schema';

@Injectable()
export class StoresService {
  constructor(
    @InjectModel(Store.name) private readonly stores: Model<Store>,
    private readonly config: ConfigService,
  ) {}

  findAll() {
    return this.stores.find({ status: 'ACTIVE' }).sort('storeName').exec();
  }

  async findOne(id: string) {
    const store = await this.stores.findOne({ storeId: id }).exec();
    if (!store || store.status !== 'ACTIVE') {
      throw new NotFoundException({ code: ErrorCode.STORE_NOT_FOUND, message: 'Không tìm thấy cửa hàng đang hoạt động' });
    }
    return store;
  }

  create(dto: CreateStoreDto) {
    const { defaultShippingFee } = getBusinessRules(this.config);
    return this.stores.create({
      ...dto,
      shippingFee: { ...dto.shippingFee, baseFee: dto.shippingFee?.baseFee ?? defaultShippingFee },
    });
  }

  async update(id: string, dto: UpdateStoreDto) {
    const update: Record<string, unknown> = { ...dto };
    if (dto.shippingFee) {
      for (const [key, value] of Object.entries(dto.shippingFee)) {
        update[`shippingFee.${key}`] = value;
      }
      delete update.shippingFee;
    }
    const store = await this.stores.findOneAndUpdate({ storeId: id }, update, { new: true, runValidators: true }).exec();
    if (!store) throw new NotFoundException({ code: ErrorCode.STORE_NOT_FOUND, message: 'Không tìm thấy cửa hàng' });
    return store;
  }
}
