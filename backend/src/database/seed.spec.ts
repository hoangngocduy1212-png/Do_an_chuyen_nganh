import { Connection, Types, createConnection } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createIndexes } from '../../database/scripts/create-indexes';
import { seedDatabase } from '../../database/seed/seed';

describe('database seed', () => {
  let replicaSet: MongoMemoryReplSet;
  let connection: Connection;

  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
  }, 120_000);

  afterAll(async () => {
    await connection?.close();
    await replicaSet?.stop();
  });

  it('tạo 80 sản phẩm, 600 đơn và chạy lặp lại không nhân bản dữ liệu', async () => {
    const uri = replicaSet.getUri('muadee_seed_test');
    await createIndexes(uri);
    await seedDatabase(uri, true);
    await seedDatabase(uri, false);
    connection = await createConnection(uri).asPromise();

    expect(await connection.collection('products').countDocuments()).toBe(80);
    expect(await connection.collection('orders').countDocuments()).toBe(600);
    expect(await connection.collection('inventories').countDocuments()).toBe(240);
    expect(await connection.collection('users').countDocuments()).toBe(34);
    expect(await connection.collection('knowledgedocuments').countDocuments()).toBe(30);
    expect(await connection.collection('aiconfigs').countDocuments()).toBe(3);
    const userIndexes = await connection.collection('users').indexes();
    expect(userIndexes.some((index) => index.name === 'email_1' && index.unique === true)).toBe(true);
    const activityIndexes = await connection.collection('useractivities').indexes();
    expect(activityIndexes.some((index) => index.expireAfterSeconds === 180 * 24 * 60 * 60)).toBe(true);

    const mainCustomer = await connection.collection('customers').findOne({ customerId: '000000020000000000000001' });
    expect(mainCustomer?.addresses).toHaveLength(2);
    const productWithNormalizedSearch = await connection.collection('products').findOne({ productId: '000000070000000000000001' });
    expect(productWithNormalizedSearch?._id).toBeInstanceOf(Types.ObjectId);
    expect(productWithNormalizedSearch?.productId).toBe(productWithNormalizedSearch?._id.toHexString());
    expect(productWithNormalizedSearch?.searchText).toContain('ca chua');
    expect(await connection.collection('inventories').countDocuments({ productId: productWithNormalizedSearch?.productId })).toBeGreaterThan(0);
    const weightedOrderItem = await connection.collection('orderitems').findOne({ actualWeight: { $exists: true } });
    expect(weightedOrderItem).not.toBeNull();
    const unweighedOrderItem = await connection.collection('orderitems').findOne({
      unit: 'kg',
      actualWeight: { $exists: false },
    });
    expect(unweighedOrderItem).not.toBeNull();
  }, 120_000);
});
