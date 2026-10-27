import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

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
