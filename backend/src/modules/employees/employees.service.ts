import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Employee } from './schemas/employee.schema';
import { Store } from '../stores/schemas/store.schema';
import { UsersService } from '../users/users.service';
import { UpdateProfileDto } from '../users/dto/user.dto';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectModel(Employee.name) private readonly employees: Model<Employee>,
    @InjectModel(Store.name) private readonly stores: Model<Store>,
    private readonly users: UsersService,
  ) {}

  async profile(user: AuthUser) {
    // Hồ sơ nhân viên được tra bằng userId lấy từ JWT, không nhận ID từ trình duyệt.
    const employee = await this.employees.findOne({ userId: user.userId }).lean().exec();
    if (!employee) throw new NotFoundException('Không tìm thấy hồ sơ nhân viên');

    const [profile, store] = await Promise.all([
      this.users.getProfile(user.userId),
      this.stores.findOne({ storeId: employee.storeId }).select('storeId storeName address phone status').lean().exec(),
    ]);
    return {
      user: profile,
      employee: {
        employeeId: employee.employeeId,
        employeeCode: employee.employeeCode,
        employeeRole: employee.employeeRole,
        storeId: employee.storeId,
      },
      store,
    };
  }

  async updateProfile(user: AuthUser, dto: UpdateProfileDto) {
    // Chỉ cập nhật thông tin cá nhân; không cho nhân viên tự đổi vai trò hoặc cửa hàng.
    await this.profile(user);
    await this.users.updateProfile(user.userId, dto);
    return this.profile(user);
  }
}
