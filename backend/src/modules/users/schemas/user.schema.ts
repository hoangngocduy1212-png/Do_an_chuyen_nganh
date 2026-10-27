import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role, UserStatus } from '../../../common/constants/roles';

export type UserDocument = HydratedDocument<User>;

// Collection User (bao cao muc 3.2.3.1). _id cua Mongo chinh la userId.
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true }) fullName: string;
  @Prop({ required: true, unique: true, lowercase: true, trim: true }) email: string;
  @Prop() phone?: string;
  @Prop({ required: true, select: false }) password: string; // da bam bang bcrypt
  @Prop({ type: String, enum: Role, default: Role.CUSTOMER }) role: Role;
  @Prop({ type: String, enum: UserStatus, default: UserStatus.ACTIVE }) status: UserStatus;
}

export const UserSchema = SchemaFactory.createForClass(User);
