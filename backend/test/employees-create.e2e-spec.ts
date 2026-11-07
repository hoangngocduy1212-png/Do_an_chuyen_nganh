import { CanActivate, ExecutionContext, INestApplication, Injectable, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { Connection, Model, createConnection } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { Role } from '../src/common/constants/roles';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { AdminEmployeesController } from '../src/modules/employees/admin-employees.controller';
import { EmployeeAccountsService } from '../src/modules/employees/employee-accounts.service';
import { Employee, EmployeeSchema } from '../src/modules/employees/schemas/employee.schema';
import { Store, StoreSchema } from '../src/modules/stores/schemas/store.schema';
import { User, UserSchema } from '../src/modules/users/schemas/user.schema';

@Injectable()
class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: unknown }>();
    if (req.headers.authorization === 'Bearer admin-test') req.user = { userId: 'admin', role: Role.ADMIN };
    else if (req.headers.authorization === 'Bearer staff-test') req.user = { userId: 'staff', role: Role.STAFF };
    else throw new UnauthorizedException();
    return true;
  }
}

describe('Tạo tài khoản nhân viên (e2e)', () => {
  let replica: MongoMemoryReplSet;
  let connection: Connection;
  let app: INestApplication;
  let users: Model<User>;
  let employees: Model<Employee>;
  let stores: Model<Store>;

  beforeAll(async () => {
    replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    connection = await createConnection(replica.getUri()).asPromise();
    users = connection.model(User.name, UserSchema);
    employees = connection.model(Employee.name, EmployeeSchema);
    stores = connection.model(Store.name, StoreSchema);
    await Promise.all([users.init(), employees.init(), stores.init()]);
    await stores.create({ storeId: 'store-1', storeName: 'Test', address: 'Test', phone: '0900000000', status: 'ACTIVE', shippingFee: { baseFee: 0 } });
    const service = new EmployeeAccountsService(connection, users, employees, stores, { get: () => 10 } as never);
    const module = await Test.createTestingModule({
      controllers: [AdminEmployeesController], providers: [{ provide: EmployeeAccountsService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalGuards(new TestJwtGuard(), new RolesGuard(new Reflector()));
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  }, 120000);

  afterAll(async () => { await app?.close(); await connection?.close(); await replica?.stop(); });

  it('chỉ admin tạo được tài khoản STAFF với mật khẩu băm và cửa hàng hợp lệ', async () => {
    const body = { fullName: 'Staff Test', email: 'Staff@example.test', phone: '0901234567', password: 'Password123', employeeCode: 'nv-test', employeeRole: 'Nhân viên', storeId: 'store-1' };
    await request(app.getHttpServer()).post('/api/v1/employees').set('Authorization', 'Bearer staff-test').send(body).expect(403);
    await request(app.getHttpServer()).post('/api/v1/employees').set('Authorization', 'Bearer admin-test').send({ ...body, password: 'short' }).expect(400);
    await request(app.getHttpServer()).post('/api/v1/employees').set('Authorization', 'Bearer admin-test').send({ ...body, storeId: 'missing' }).expect(404);
    expect(await users.countDocuments()).toBe(0);
    const created = await request(app.getHttpServer()).post('/api/v1/employees').set('Authorization', 'Bearer admin-test').send(body).expect(201);
    expect(created.body.data).toMatchObject({ email: 'staff@example.test', employeeCode: 'NV-TEST', storeId: 'store-1' });
    expect(created.body.data.password).toBeUndefined();
    const user = await users.findOne({ email: 'staff@example.test' }).select('+password').lean().exec();
    expect(user?.role).toBe(Role.STAFF);
    expect(await bcrypt.compare(body.password, user!.password)).toBe(true);
    expect(await employees.findOne({ userId: user!.userId }).lean().exec()).toMatchObject({ storeId: 'store-1', employeeCode: 'NV-TEST' });
    await request(app.getHttpServer()).post('/api/v1/employees').set('Authorization', 'Bearer admin-test').send(body).expect(409);
    await request(app.getHttpServer()).post('/api/v1/employees').set('Authorization', 'Bearer admin-test').send({ ...body, email: 'different@example.test' }).expect(409);
    expect(await users.countDocuments()).toBe(1);
  });
});
