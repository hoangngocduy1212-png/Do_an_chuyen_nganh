import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/constants/roles';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeeAccountsService } from './employee-accounts.service';

@ApiTags('employees')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('employees')
export class AdminEmployeesController {
  constructor(private readonly accounts: EmployeeAccountsService) {}

  // Chỉ quản trị viên được tạo tài khoản nhân viên và gán vào cửa hàng.
  @Post()
  create(@Body() dto: CreateEmployeeDto) {
    return this.accounts.create(dto);
  }
}
