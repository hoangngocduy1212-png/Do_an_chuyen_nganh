import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { applyIdPlugin } from '../../../common/database/id-plugin';

@Schema({ timestamps: true, versionKey: false })
export class Counter {
  @Prop({ type: String, required: true }) counterKey: string;
  @Prop({ type: Number, required: true, min: 0, default: 0 }) seq: number;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);
CounterSchema.index({ counterKey: 1 }, { unique: true });
applyIdPlugin(CounterSchema, 'counterId');

export async function nextOrderCode(
  counterModel: Model<Counter>,
  now = new Date(),
  session?: ClientSession,
): Promise<string> {
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(now).split('/').reverse().join('');
  const counterKey = `order-${date}`;
  const query = counterModel.findOneAndUpdate(
    { counterKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  if (session) query.session(session);
  const counter = await query.exec();

  if (!counter) throw new Error('Không thể cấp số thứ tự mã đơn hàng');
  return `MD${date}${String(counter.seq).padStart(3, '0')}`;
}
