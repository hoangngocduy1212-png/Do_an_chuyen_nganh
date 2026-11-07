import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Connection, Model } from 'mongoose';
import { Role, UserStatus } from '../../common/constants/roles.enum';
import { User } from '../users/schemas/user.schema';
import { Store } from '../stores/schemas/store.schema';
import { Employee } from './schemas/employee.schema';
import { CreateEmployeeDto } from './dto/create-employee.dto';

@Injectable()
export class EmployeeAccountsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Employee.name) private readonly employees: Model<Employee>,
    @InjectModel(Store.name) private readonly stores: Model<Store>,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateEmployeeDto) {
    const email = dto.email.trim().toLowerCase();
    const employeeCode = dto.employeeCode.trim().toUpperCase();
    const userId = randomUUID();
    const employeeId = randomUUID();
    const password = await bcrypt.hash(dto.password, this.config.get<number>('bcryptCost') ?? 12);
    const session = await this.connection.startSession();

    try {
      // Tạo User và Employee trong cùng transaction để không có tài khoản thiếu cửa hàng.
      await session.withTransaction(async () => {
        const store = await this.stores.findOne({ storeId: dto.storeId, status: 'ACTIVE' }).session(session).lean().exec();
        if (!store) throw new NotFoundException('Không tìm thấy cửa hàng đang hoạt động');
        if (await this.users.exists({ email }).session(session)) throw new ConflictException('Email đã được sử dụng');
        if (await this.employees.exists({ employeeCode }).session(session)) throw new ConflictException('Mã nhân viên đã được sử dụng');
        await this.users.create([{
          userId, fullName: dto.fullName.trim(), email, phone: dto.phone,
          password, role: Role.STAFF, status: UserStatus.ACTIVE, refreshTokenHashes: [],
        }], { session });
        await this.employees.create([{
          employeeId, userId, employeeCode, employeeRole: dto.employeeRole.trim(), storeId: store.storeId,
        }], { session });
      });
    } catch (error) {
      // Unique index vẫn bảo vệ khi hai yêu cầu cùng dùng email hoặc mã nhân viên.
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        throw new ConflictException('Email hoặc mã nhân viên đã được sử dụng');
      }
      throw error;
    } finally {
      await session.endSession();
    }
    // Không trả mật khẩu hoặc hash mật khẩu trong API.
    return { userId, employeeId, fullName: dto.fullName.trim(), email, employeeCode, employeeRole: dto.employeeRole.trim(), storeId: dto.storeId };
  }
}
