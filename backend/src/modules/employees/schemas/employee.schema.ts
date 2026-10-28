import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { applyIdPlugin } from '../../../common/database/id-plugin';

@Schema({ timestamps: true, versionKey: false })
export class Employee {
  @Prop({ type: String, required: true, unique: true, default: randomUUID }) employeeId: string;
  @Prop({ type: String, required: true, unique: true }) userId: string;
  @Prop({ type: String, required: true, unique: true }) employeeCode: string;
  @Prop({ type: String, required: true }) employeeRole: string;
  @Prop({ type: String, required: true, index: true }) storeId: string;
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);
applyIdPlugin(EmployeeSchema, 'employeeId');