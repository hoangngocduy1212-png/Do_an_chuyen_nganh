import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AddressDto, ChangePasswordDto, DeleteAccountDto, UpdateProfileDto } from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  // GET /users/me - xem ho so ca nhan (API.md muc 1)
  @Get('me')
  me(@CurrentUser() auth: AuthUser) {
    return this.users.getProfile(auth.userId);
  }

  @Patch('me')
  updateMe(@CurrentUser() auth: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(auth.userId, dto);
  }

  @Patch('me/password')
  changePassword(@CurrentUser() auth: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.users.changePassword(auth.userId, dto.currentPassword, dto.newPassword);
  }

  @Delete('me')
  deleteMe(@CurrentUser() auth: AuthUser, @Body() dto: DeleteAccountDto) {
    return this.users.deleteAccount(auth.userId, dto.password);
  }

  @Get('me/addresses')
  addresses(@CurrentUser() auth: AuthUser) {
    return this.users.listAddresses(auth.userId);
  }

  @Post('me/addresses')
  createAddress(@CurrentUser() auth: AuthUser, @Body() dto: AddressDto) {
    return this.users.createAddress(auth.userId, dto);
  }

  @Patch('me/addresses/:addressId/default')
  setDefault(@CurrentUser() auth: AuthUser, @Param('addressId') addressId: string) {
    return this.users.setDefaultAddress(auth.userId, addressId);
  }

  @Patch('me/addresses/:addressId')
  updateAddress(@CurrentUser() auth: AuthUser, @Param('addressId') addressId: string, @Body() dto: AddressDto) {
    return this.users.updateAddress(auth.userId, addressId, dto);
  }

  @Delete('me/addresses/:addressId')
  deleteAddress(@CurrentUser() auth: AuthUser, @Param('addressId') addressId: string) {
    return this.users.deleteAddress(auth.userId, addressId);
  }
}
