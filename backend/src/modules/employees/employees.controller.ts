import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/constants/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { InventoryQueryDto } from '../inventory/dto/inventory.dto';
import { InventoryService } from '../inventory/inventory.service';
import { CancelOrderDto, OrderListQueryDto, UpdateOrderStatusDto, UpdateWeightDto } from '../orders/dto/order.dto';
import { OrdersApiService } from '../orders/orders-api.service';
import { UpdateProfileDto } from '../users/dto/user.dto';
import { EmployeesService } from './employees.service';
import { EmployeeOperationsService } from './employee-operations.service';
import { CreateOrderIssueDto, EmployeeListQueryDto, ReviewVisibilityDto, StaffMessageDto } from './dto/employee-operations.dto';
import { CreateVoucherDto, UpdateVoucherDto } from '../vouchers/dto/voucher.dto';
import { VouchersService } from '../vouchers/vouchers.service';

@ApiTags('employees')
@ApiBearerAuth()
@Roles(Role.STAFF)
@Controller('employees/me')
export class EmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly orders: OrdersApiService,
    private readonly inventory: InventoryService,
    private readonly operations: EmployeeOperationsService,
    private readonly vouchers: VouchersService,
  ) {}

  // Xem tài khoản, mã nhân viên và cửa hàng đang làm việc.
  @Get()
  profile(@CurrentUser() user: AuthUser) {
    return this.employees.profile(user);
  }

  // DTO chỉ nhận tên, số điện thoại và ảnh đại diện.
  @Patch()
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.employees.updateProfile(user, dto);
  }

  // Các thao tác dưới đây dùng lại service nghiệp vụ để giữ nguyên kiểm tra
  // cửa hàng, trạng thái đơn, khối lượng và tồn kho ở một nơi duy nhất.
  // Service tự giới hạn danh sách theo cửa hàng trong JWT của nhân viên.
  @Get('orders')
  listOrders(@CurrentUser() user: AuthUser, @Query() query: OrderListQueryDto) {
    return this.orders.list(user, query);
  }

  // Chỉ trả chi tiết nếu đơn thuộc cùng cửa hàng.
  @Get('orders/:id')
  orderDetails(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.getOne(user, id);
  }

  // Tiếp nhận chuyển đơn hợp lệ sang trạng thái đang chuẩn bị.
  @Post('orders/:id/accept')
  acceptOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.accept(user, id);
  }

  // Chỉ hủy đơn chờ xử lý và chưa thanh toán; tồn đã giữ sẽ được giải phóng.
  @Post('orders/:id/cancel')
  cancelOrder(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.orders.cancelByStaff(user, id, dto);
  }

  // Ghi nhận thiếu hàng hoặc thông tin sai, sau đó theo dõi đến khi được xử lý.
  @Post('orders/:id/issues')
  reportIssue(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateOrderIssueDto) {
    return this.operations.reportIssue(user, id, dto);
  }

  @Get('issues')
  listIssues(@CurrentUser() user: AuthUser, @Query() query: EmployeeListQueryDto) {
    return this.operations.listIssues(user, query);
  }

  @Post('issues/:id/resolve')
  resolveIssue(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.operations.resolveIssue(user, id);
  }

  // Sau khi cân, đơn hàng được tính lại theo khối lượng thực tế.
  @Patch('orders/:id/items/:itemId/weight')
  updateWeight(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: UpdateWeightDto) {
    return this.orders.updateWeight(user, id, itemId, dto);
  }

  // Service kiểm tra chuyển trạng thái trước khi cập nhật.
  @Patch('orders/:id/status')
  updateStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orders.changeStatus(user, id, dto);
  }

  // Bỏ qua storeId do trình duyệt gửi khi lọc dữ liệu của nhân viên.
  @Get('inventory')
  listInventory(@CurrentUser() user: AuthUser, @Query() query: InventoryQueryDto) {
    return this.inventory.list(query, user);
  }

  // Đánh giá được chọn theo cửa hàng của đơn gốc, không theo dữ liệu client gửi.
  @Get('reviews')
  listReviews(@CurrentUser() user: AuthUser, @Query() query: EmployeeListQueryDto) {
    return this.operations.listReviews(user, query);
  }

  @Patch('reviews/:id/visibility')
  reviewVisibility(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReviewVisibilityDto) {
    return this.operations.setReviewVisibility(user, id, dto.isHidden);
  }

  // Chỉ phiên đã yêu cầu nhân viên hỗ trợ tại cửa hàng mới xuất hiện ở đây.
  @Get('support/sessions')
  listSupport(@CurrentUser() user: AuthUser, @Query() query: EmployeeListQueryDto) {
    return this.operations.listSessions(user, query);
  }

  @Post('support/sessions/:id/claim')
  claimSupport(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.operations.claimSession(user, id);
  }

  @Get('support/sessions/:id/messages')
  supportMessages(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.operations.sessionMessages(user, id);
  }

  @Post('support/sessions/:id/messages')
  replySupport(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: StaffMessageDto) {
    return this.operations.reply(user, id, dto.content);
  }

  @Post('support/sessions/:id/close')
  closeSupport(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.operations.closeSession(user, id);
  }

  // Voucher trong dự án là dữ liệu dùng chung cho toàn hệ thống, không theo cửa hàng.
  @Get('vouchers')
  listVouchers() { return this.vouchers.findAll(); }

  @Post('vouchers')
  createVoucher(@Body() dto: CreateVoucherDto) { return this.vouchers.create(dto); }

  @Patch('vouchers/:id')
  updateVoucher(@Param('id') id: string, @Body() dto: UpdateVoucherDto) { return this.vouchers.update(id, dto); }

  @Delete('vouchers/:id')
  deleteVoucher(@Param('id') id: string) { return this.vouchers.remove(id); }
}
