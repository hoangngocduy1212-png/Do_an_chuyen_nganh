import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  // GET /users/me - xem ho so ca nhan (API.md muc 1)
  @Get('me')
  async me(@CurrentUser() auth: AuthUser) {
    const user = await this.users.findById(auth.userId);
    if (!user) throw new NotFoundException('Khong tim thay nguoi dung');
    return user;
  }
}
