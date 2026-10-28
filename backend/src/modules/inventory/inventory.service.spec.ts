import { ConflictException } from '@nestjs/common';
import { Connection, Model, createConnection } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { InventoryService } from './inventory.service';
import { Inventory, InventorySchema } from './schemas/inventory.schema';
import { Role } from '../../common/constants/roles.enum';

describe('InventoryService concurrent reservations', () => {
  let replicaSet: MongoMemoryReplSet;
  let connection: Connection;
  let model: Model<Inventory>;
  let service: InventoryService;

  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    connection = await createConnection(replicaSet.getUri()).asPromise();
    model = connection.model<Inventory>(Inventory.name, InventorySchema);
    service = new InventoryService(model);
  }, 120_000);

  afterAll(async () => {
    await connection?.close();
    await replicaSet?.stop();
  });

  beforeEach(async () => {
    await model.deleteMany({});
  });

  it('chỉ giữ thành công đúng 5 trong 20 yêu cầu cạnh tranh cùng sản phẩm', async () => {
    await model.create({ storeId: 'store-test', productId: 'product-test', quantity: 5, reservedQuantity: 0 });

    const results = await Promise.all(Array.from({ length: 20 }, async () => {
      const session = await connection.startSession();
      try {
        await session.withTransaction(() => service.reserve([
          { storeId: 'store-test', productId: 'product-test', quantity: 1 },
        ], session));
        return true;
      } catch (error) {
        if (error instanceof ConflictException) {
          const response = error.getResponse();
          if (typeof response === 'object' && response !== null && 'code' in response && response.code === 'OUT_OF_STOCK') {
            return false;
          }
        }
        throw error;
      } finally {
        await session.endSession();
      }
    }));

    expect(results.filter(Boolean)).toHaveLength(5);
    const inventory = await model.findOne({ storeId: 'store-test', productId: 'product-test' }).lean().exec();
    expect(inventory?.reservedQuantity).toBe(5);
  }, 120_000);

  it('release hoàn lại lượng giữ mà không đổi lượng tồn', async () => {
    await model.create({ storeId: 'store-test', productId: 'product-test', quantity: 5, reservedQuantity: 0 });
    const session = await connection.startSession();
    try {
      await session.withTransaction(async () => {
        const request = [{ storeId: 'store-test', productId: 'product-test', quantity: 2 }];
        await service.reserve(request, session);
        await service.release(request, session);
      });
    } finally {
      await session.endSession();
    }

    const inventory = await model.findOne({ storeId: 'store-test', productId: 'product-test' }).lean().exec();
    expect(inventory?.quantity).toBe(5);
    expect(inventory?.reservedQuantity).toBe(0);
  });

  it('commit trừ tồn vật lý và lượng đã giữ cùng lúc', async () => {
    await model.create({ storeId: 'store-test', productId: 'product-test', quantity: 5, reservedQuantity: 0 });
    const session = await connection.startSession();
    try {
      await session.withTransaction(async () => {
        const request = [{ storeId: 'store-test', productId: 'product-test', quantity: 3 }];
        await service.reserve(request, session);
        await service.commit(request, session);
      });
    } finally {
      await session.endSession();
    }

    const inventory = await model.findOne({ storeId: 'store-test', productId: 'product-test' }).lean().exec();
    expect(inventory?.quantity).toBe(2);
    expect(inventory?.reservedQuantity).toBe(0);
  });

  it('hoàn tác các dòng đã giữ khi giỏ có dòng không đủ tồn', async () => {
    await model.create([
      { storeId: 'store-test', productId: 'available', quantity: 4, reservedQuantity: 0 },
      { storeId: 'store-test', productId: 'unavailable', quantity: 0, reservedQuantity: 0 },
    ]);
    const session = await connection.startSession();
    try {
      await expect(session.withTransaction(() => service.reserve([
        { storeId: 'store-test', productId: 'available', quantity: 2 },
        { storeId: 'store-test', productId: 'unavailable', quantity: 1 },
      ], session))).rejects.toBeInstanceOf(ConflictException);
    } finally {
      await session.endSession();
    }

    const inventory = await model.find({ storeId: 'store-test' }).sort({ productId: 1 }).lean().exec();
    expect(inventory.map((item) => item.reservedQuantity)).toEqual([0, 0]);
  });

  it('giới hạn nhân viên vào tồn kho của cửa hàng trong JWT', async () => {
    await model.create([
      { storeId: 'store-own', productId: 'product-a', quantity: 5 },
      { storeId: 'store-other', productId: 'product-b', quantity: 8 },
    ]);

    const result = await service.list(
      { storeId: 'store-other' },
      { userId: 'staff-1', role: Role.STAFF, storeId: 'store-own' },
    );

    expect(result.map((entry) => entry.storeId)).toEqual(['store-own']);
  });

  it('nhập tồn và từ chối xuất vượt quá tồn khả dụng', async () => {
    await service.change({ storeId: 'store-test', productId: 'product-test', quantity: 5 }, 'import');

    await expect(service.change(
      { storeId: 'store-test', productId: 'product-test', quantity: 6 },
      'export',
    )).rejects.toMatchObject({
      response: { code: 'OUT_OF_STOCK' },
    });

    const inventory = await model.findOne({ storeId: 'store-test', productId: 'product-test' }).lean().exec();
    expect(inventory?.quantity).toBe(5);
  });
});
