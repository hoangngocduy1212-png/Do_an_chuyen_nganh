import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/constants/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MembershipsService } from './memberships.service';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

class TransactionsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 10;
}

@ApiTags('memberships')
@ApiBearerAuth()
@Roles(Role.CUSTOMER)
@Controller('memberships')
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.memberships.summary(user.userId);
  }

  @Get('me/transactions')
  transactions(@CurrentUser() user: AuthUser, @Query() query: TransactionsQueryDto) {
    return this.memberships.transactions(user.userId, query.page, query.limit);
  }
}
