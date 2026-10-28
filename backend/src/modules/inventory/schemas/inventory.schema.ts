import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { applyIdPlugin } from '../../../common/database/id-plugin';

@Schema({ timestamps: true, versionKey: false })
export class Inventory {
  @Prop({ type: String, required: true }) storeId: string;
  @Prop({ type: String, required: true }) productId: string;
  @Prop({ type: Number, required: true, min: 0, default: 0 }) quantity: number;
  @Prop({ type: Number, min: 0, default: 0 }) reservedQuantity: number;
  @Prop({ type: Number, min: 0, default: 10 }) lowStockThreshold: number;
}

export const InventorySchema = SchemaFactory.createForClass(Inventory);
InventorySchema.index({ storeId: 1, productId: 1 }, { unique: true });
InventorySchema.index({ storeId: 1, quantity: 1 });
applyIdPlugin(InventorySchema, 'inventoryId');
