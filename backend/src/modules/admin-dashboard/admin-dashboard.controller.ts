import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/constants/roles';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminDashboardService } from './admin-dashboard.service';

@ApiTags('admin-dashboard')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get()
  overview() {
    return this.dashboard.overview();
  }
}
