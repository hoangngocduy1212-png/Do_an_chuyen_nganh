import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/constants/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CreateStoreDto, ServiceabilityDto, UpdateStoreDto } from './dto/store.dto';
import { StoresService } from './stores.service';

@ApiTags('stores')
@ApiBearerAuth()
@Controller('stores')
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  findAll(@CurrentUser() user?: AuthUser) {
    return this.stores.findAll(user);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.stores.findOne(id, user);
  }

  @Public()
  @Post(':id/serviceability')
  serviceability(@Param('id') id: string, @Body() dto: ServiceabilityDto) {
    return this.stores.serviceability(id, dto.address);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateStoreDto) {
    return this.stores.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStoreDto) {
    return this.stores.update(id, dto);
  }
}
