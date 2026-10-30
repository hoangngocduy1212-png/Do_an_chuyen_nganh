import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { getBusinessRules } from '../../common/constants/business-rules';
import { ErrorCode } from '../../common/constants/error-codes';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/constants/roles';
import { matchesDeliveryZone } from '../../common/utils/delivery-zone';
import { CreateStoreDto, UpdateStoreDto } from './dto/store.dto';
import { Store } from './schemas/store.schema';

@Injectable()
export class StoresService {
  constructor(
    @InjectModel(Store.name) private readonly stores: Model<Store>,
    private readonly config: ConfigService,
  ) {}

  findAll(user?: AuthUser) {
    const filter = user?.role === Role.ADMIN ? {} : { status: 'ACTIVE' };
    return this.stores.find(filter).sort('storeName').exec();
  }

  async findOne(id: string, user?: AuthUser) {
    const store = await this.stores.findOne({ storeId: id }).exec();
    if (!store || (store.status !== 'ACTIVE' && user?.role !== Role.ADMIN)) {
      throw new NotFoundException({ code: ErrorCode.STORE_NOT_FOUND, message: 'Không tìm thấy cửa hàng đang hoạt động' });
    }
    return store;
  }

  async serviceability(id: string, address: string) {
    const store = await this.findOne(id);
    const serviceable = matchesDeliveryZone(address, store.deliveryZones);
    return { serviceable, estimatedFee: serviceable ? store.shippingFee?.baseFee ?? 0 : 0 };
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
