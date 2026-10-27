import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';
import { Role, UserStatus } from '../../../common/constants/roles.enum';

export type UserDocument = HydratedDocument<User>;

// Collection User (báo cáo mục 3.2.3.1); userId là khóa định danh công khai.
@Schema({ timestamps: true, versionKey: false })
export class User {
  @Prop({ type: String, required: true, unique: true, default: randomUUID }) userId: string;
  @Prop({ required: true }) fullName: string;
  @Prop({ required: true, unique: true, lowercase: true, trim: true }) email: string;
  @Prop() phone?: string;
  @Prop({ required: true, select: false }) password: string;
  @Prop({ type: String, enum: Role, default: Role.CUSTOMER }) role: Role;
  @Prop({ type: String, enum: UserStatus, default: UserStatus.ACTIVE }) status: UserStatus;
  // Chỉ lưu SHA-256 token, không bao giờ lưu token đặt lại gốc.
  @Prop({ type: String, select: false }) passwordResetToken?: string;
  @Prop({ type: Date }) passwordResetExpires?: Date;
  // Mỗi phần tử là một phiên đăng nhập khác nhau; chỉ lưu hash refresh token.
  @Prop({ type: [{ hash: { type: String, required: true }, expiresAt: { type: Date, required: true } }], default: [], select: false })
  refreshTokenHashes: Array<{ hash: string; expiresAt: Date }>;
}

export const UserSchema = SchemaFactory.createForClass(User);
