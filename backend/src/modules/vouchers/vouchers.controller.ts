import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/constants/roles';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateVoucherDto, UpdateVoucherDto, ValidateVoucherDto, AvailableVoucherQueryDto } from './dto/voucher.dto';
import { VouchersService } from './vouchers.service';

@ApiTags('vouchers')
@ApiBearerAuth()
@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  @Roles(Role.ADMIN)
  @Get()
  findAll() {
    return this.vouchers.findAll();
  }

  @Roles(Role.CUSTOMER)
  @Get('available')
  available(@Query() query: AvailableVoucherQueryDto) {
    return this.vouchers.available(query.orderAmount);
  }

  @Roles(Role.CUSTOMER)
  @Post('validate')
  async validate(@Body() dto: ValidateVoucherDto) {
    const result = await this.vouchers.validate(dto.code, dto.orderAmount);
    return { code: result.voucher.code, discountAmount: result.discountAmount };
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateVoucherDto) {
    return this.vouchers.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVoucherDto) {
    return this.vouchers.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vouchers.remove(id);
  }
}
