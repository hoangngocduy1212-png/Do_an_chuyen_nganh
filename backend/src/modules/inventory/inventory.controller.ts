import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/constants/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { InventoryChangeDto, InventoryQueryDto } from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.STAFF)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  list(@Query() query: InventoryQueryDto, @CurrentUser() user: AuthUser) {
    return this.inventory.list(query, user);
  }

  @Roles(Role.ADMIN)
  @Post('import')
  import(@Body() dto: InventoryChangeDto) {
    return this.inventory.change(dto, 'import');
  }

  @Roles(Role.ADMIN)
  @Post('export')
  export(@Body() dto: InventoryChangeDto) {
    return this.inventory.change(dto, 'export');
  }
}
