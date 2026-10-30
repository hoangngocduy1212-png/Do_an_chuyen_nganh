import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { ClientSession, Model } from 'mongoose';
import { ErrorCode } from '../../common/constants/error-codes';
import { Customer, CustomerAddress } from '../customers/schemas/customer.schema';
import { Membership } from '../memberships/schemas/membership.schema';
import { AddressDto, UpdateProfileDto } from './dto/user.dto';
import { User, UserDocument } from './schemas/user.schema';

const MAX_ADDRESSES = 5;

function toAddressView(address: CustomerAddress) {
  return {
    addressId: address.addressId,
    label: address.label,
    recipientName: address.recipientName,
    phoneNumber: address.phone,
    addressLine: address.addressLine,
    isDefault: address.isDefault,
  };
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Customer.name) private customers: Model<Customer>,
    @InjectModel(Membership.name) private memberships: Model<Membership>,
    private readonly config: ConfigService,
  ) {}

  async getProfile(userId: string): Promise<Record<string, unknown>> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('Khong tim thay nguoi dung');
    const customer = await this.customers.findOne({ userId }).lean().exec();
    const defaultAddress = customer?.addresses?.find((item) => item.isDefault) ?? customer?.addresses?.[0];
    return { ...user.toJSON(), createdAt: (user as unknown as { createdAt?: Date }).createdAt, defaultAddress: defaultAddress?.addressLine };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const set: Record<string, unknown> = {};
    if (dto.fullName !== undefined) set.fullName = dto.fullName.trim();
    if (dto.phoneNumber !== undefined) set.phone = dto.phoneNumber.trim();
    if (dto.avatarUrl !== undefined) set.avatar = dto.avatarUrl;
    if (Object.keys(set).length) await this.userModel.updateOne({ userId }, { $set: set });
    return this.getProfile(userId);
  }

  async listAddresses(userId: string) {
    const customer = await this.getCustomer(userId);
    return customer.addresses.map(toAddressView);
  }

  async createAddress(userId: string, dto: AddressDto) {
    const customer = await this.getCustomer(userId);
    if (customer.addresses.length >= MAX_ADDRESSES) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Bạn chỉ có thể lưu tối đa 5 địa chỉ' });
    }
    const isDefault = dto.isDefault || customer.addresses.length === 0;
    if (isDefault) customer.addresses.forEach((item) => { item.isDefault = false; });
    customer.addresses.push({ addressId: randomUUID(), label: dto.label, recipientName: dto.recipientName, phone: dto.phoneNumber, addressLine: dto.addressLine, isDefault });
    await customer.save();
    return toAddressView(customer.addresses[customer.addresses.length - 1]);
  }

  async updateAddress(userId: string, addressId: string, dto: AddressDto) {
    const customer = await this.getCustomer(userId);
    const address = this.findAddress(customer, addressId);
    if (dto.isDefault) customer.addresses.forEach((item) => { item.isDefault = false; });
    Object.assign(address, { label: dto.label, recipientName: dto.recipientName, phone: dto.phoneNumber, addressLine: dto.addressLine, isDefault: dto.isDefault || address.isDefault });
    await customer.save();
    return toAddressView(address);
  }

  async deleteAddress(userId: string, addressId: string) {
    const customer = await this.getCustomer(userId);
    const address = this.findAddress(customer, addressId);
    customer.addresses = customer.addresses.filter((item) => item.addressId !== addressId);
    if (address.isDefault && customer.addresses.length) customer.addresses[0].isDefault = true;
    await customer.save();
    return { deleted: true };
  }

  async setDefaultAddress(userId: string, addressId: string) {
    const customer = await this.getCustomer(userId);
    this.findAddress(customer, addressId);
    customer.addresses.forEach((item) => { item.isDefault = item.addressId === addressId; });
    await customer.save();
    return { updated: true };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.findByUserIdWithTokens(userId);
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new BadRequestException({ code: 'INVALID_CURRENT_PASSWORD', message: 'Mật khẩu hiện tại không đúng' });
    }
    const hash = await bcrypt.hash(newPassword, this.config.get<number>('bcryptCost') ?? 12);
    await this.updatePasswordAndClearTokens(userId, hash);
    return { updated: true };
  }

  async deleteAccount(userId: string, password: string) {
    const user = await this.findByUserIdWithTokens(userId);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new BadRequestException({ code: 'INVALID_CURRENT_PASSWORD', message: 'Mật khẩu không đúng' });
    }
    const customer = await this.customers.findOne({ userId }).select('customerId').lean().exec();
    if (customer) await this.memberships.deleteOne({ customerId: customer.customerId });
    await this.customers.deleteOne({ userId });
    await this.deleteByUserId(userId);
    return { deleted: true };
  }

  private async getCustomer(userId: string) {
    const customer = await this.customers.findOne({ userId }).exec();
    if (!customer) throw new NotFoundException({ code: ErrorCode.CUSTOMER_NOT_FOUND, message: 'Không tìm thấy hồ sơ khách hàng' });
    return customer;
  }

  private findAddress(customer: { addresses: CustomerAddress[] }, addressId: string) {
    const address = customer.addresses.find((item) => item.addressId === addressId);
    if (!address) throw new NotFoundException({ code: ErrorCode.VALIDATION_ERROR, message: 'Không tìm thấy địa chỉ' });
    return address;
  }

  create(data: Partial<User>, session?: ClientSession) {
    return this.userModel.create([data], session ? { session } : undefined).then(([user]) => user);
  }

  findByEmailWithPassword(email: string) {
    return this.userModel.findOne({ email: email.trim().toLowerCase() }).select('+password +refreshTokenHashes');
  }

  findById(id: string) {
    return this.userModel.findOne({ userId: id });
  }

  deleteByUserId(userId: string) {
    return this.userModel.deleteOne({ userId });
  }

  findByUserIdWithTokens(userId: string) {
    return this.userModel.findOne({ userId }).select('+password +passwordResetToken +refreshTokenHashes');
  }

  findByResetTokenHash(tokenHash: string, now: Date) {
    return this.userModel.findOne({ passwordResetToken: tokenHash, passwordResetExpires: { $gt: now } })
      .select('+passwordResetToken +refreshTokenHashes');
  }

  async addRefreshTokenHash(userId: string, hash: string, expiresAt: Date): Promise<void> {
    await this.userModel.updateOne(
      { userId },
      { $push: { refreshTokenHashes: { $each: [{ hash, expiresAt }], $slice: -5 } } },
    );
  }

  async rotateRefreshTokenHash(userId: string, oldHash: string, newHash: string, expiresAt: Date): Promise<boolean> {
    const updated = await this.userModel.findOneAndUpdate(
      { userId, 'refreshTokenHashes.hash': oldHash },
      [{
        $set: {
          refreshTokenHashes: {
            $concatArrays: [
              {
                $slice: [
                  {
                    $filter: {
                      input: { $ifNull: ['$refreshTokenHashes', []] },
                      as: 'entry',
                      cond: { $ne: ['$$entry.hash', oldHash] },
                    },
                  },
                  -4,
                ],
              },
              [{ hash: newHash, expiresAt }],
            ],
          },
        },
      }],
      { new: true, projection: { userId: 1 } },
    );
    return Boolean(updated);
  }

  async removeRefreshTokenHash(userId: string, hash: string): Promise<void> {
    await this.userModel.updateOne({ userId }, { $pull: { refreshTokenHashes: { hash } } });
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.userModel.updateOne({ userId }, { $set: { refreshTokenHashes: [] } });
  }

  async setPasswordReset(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.userModel.updateOne({ userId }, { $set: { passwordResetToken: tokenHash, passwordResetExpires: expiresAt } });
  }

  async updatePasswordAndClearTokens(userId: string, password: string): Promise<void> {
    await this.userModel.updateOne(
      { userId },
      { $set: { password, refreshTokenHashes: [] }, $unset: { passwordResetToken: 1, passwordResetExpires: 1 } },
    );
  }

  consumeResetToken(tokenHash: string, now: Date, password: string) {
    return this.userModel.findOneAndUpdate(
      { passwordResetToken: tokenHash, passwordResetExpires: { $gt: now } },
      { $set: { password, refreshTokenHashes: [] }, $unset: { passwordResetToken: 1, passwordResetExpires: 1 } },
      { new: true, projection: { userId: 1, email: 1 } },
    );
  }
}
