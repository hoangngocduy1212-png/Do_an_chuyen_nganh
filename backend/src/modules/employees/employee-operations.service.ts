import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { ChatMessage } from '../chat-messages/schemas/chat-message.schema';
import { ChatSession } from '../chat-sessions/schemas/chat-session.schema';
import { Order } from '../orders/schemas/order.schema';
import { Product } from '../products/schemas/product.schema';
import { Review } from '../reviews/schemas/review.schema';
import { Employee } from './schemas/employee.schema';
import { CreateOrderIssueDto, EmployeeListQueryDto } from './dto/employee-operations.dto';
import { OrderIssue } from './schemas/order-issue.schema';

@Injectable()
export class EmployeeOperationsService {
  constructor(
    @InjectModel(Employee.name) private readonly employees: Model<Employee>,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(Review.name) private readonly reviews: Model<Review>,
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(ChatSession.name) private readonly sessions: Model<ChatSession>,
    @InjectModel(ChatMessage.name) private readonly messages: Model<ChatMessage>,
    @InjectModel(OrderIssue.name) private readonly issues: Model<OrderIssue>,
  ) {}

  async reportIssue(user: AuthUser, orderId: string, dto: CreateOrderIssueDto) {
    const employee = await this.employee(user);
    if (!Types.ObjectId.isValid(orderId) || !await this.orders.exists({ _id: orderId, storeId: employee.storeId })) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }
    // Ghi nhận để nhân viên và khách phối hợp xử lý; không thay đổi tồn hay trạng thái đơn.
    return this.issues.create({ orderId, storeId: employee.storeId, type: dto.type,
      detail: dto.detail.trim(), createdBy: employee.employeeId, status: 'OPEN' });
  }

  async listIssues(user: AuthUser, query: EmployeeListQueryDto) {
    const employee = await this.employee(user);
    const filter = { storeId: employee.storeId };
    const [data, total] = await Promise.all([
      this.issues.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).exec(),
      this.issues.countDocuments(filter).exec(),
    ]);
    return { data, meta: { page: query.page, limit: query.limit, total } };
  }

  async resolveIssue(user: AuthUser, id: string) {
    const employee = await this.employee(user);
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Không tìm thấy phản ánh đơn hàng');
    const issue = await this.issues.findOneAndUpdate({ _id: id, storeId: employee.storeId, status: 'OPEN' },
      { $set: { status: 'RESOLVED', resolvedBy: employee.employeeId, resolvedAt: new Date() } }, { new: true }).exec();
    if (!issue) throw new NotFoundException('Không tìm thấy phản ánh đơn hàng đang mở');
    return issue;
  }

  async listReviews(user: AuthUser, query: EmployeeListQueryDto) {
    const employee = await this.employee(user);
    // Review lưu orderId dạng chuỗi; chỉ lấy đánh giá của các đơn thuộc cửa hàng.
    const orders = await this.orders.find({ storeId: employee.storeId }).select('_id').lean().exec();
    const filter = { orderId: { $in: orders.map((order) => String(order._id)) } };
    const [data, total] = await Promise.all([
      this.reviews.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).exec(),
      this.reviews.countDocuments(filter).exec(),
    ]);
    return { data, meta: { page: query.page, limit: query.limit, total } };
  }

  async setReviewVisibility(user: AuthUser, id: string, isHidden: boolean) {
    const employee = await this.employee(user);
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Không tìm thấy đánh giá');
    const review = await this.reviews.findById(id).exec();
    if (!review || !Types.ObjectId.isValid(review.orderId)
      || !await this.orders.exists({ _id: review.orderId, storeId: employee.storeId })) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }
    review.isHidden = isHidden;
    await review.save();
    // Đánh giá bị ẩn không được tính vào điểm trung bình công khai của sản phẩm.
    const [stats] = await this.reviews.aggregate<{ avg: number; count: number }>([
      { $match: { productId: review.productId, isHidden: false } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]).exec();
    await this.products.updateOne({ productId: review.productId }, {
      $set: { avgRating: stats ? Math.round(stats.avg * 10) / 10 : 0, reviewCount: stats?.count ?? 0 },
    }).exec();
    return review;
  }

  async listSessions(user: AuthUser, query: EmployeeListQueryDto) {
    const employee = await this.employee(user);
    const filter = { storeId: employee.storeId, status: 'HANDED_OVER' };
    const [data, total] = await Promise.all([
      this.sessions.find(filter).select('-guestToken').sort({ handoverRequestedAt: -1 })
        .skip((query.page - 1) * query.limit).limit(query.limit).exec(),
      this.sessions.countDocuments(filter).exec(),
    ]);
    return { data, meta: { page: query.page, limit: query.limit, total } };
  }

  async claimSession(user: AuthUser, id: string) {
    const employee = await this.employee(user);
    this.assertObjectId(id);
    // Cập nhật có điều kiện để hai nhân viên không cùng nhận một cuộc hội thoại.
    const session = await this.sessions.findOneAndUpdate({
      _id: id, storeId: employee.storeId, status: 'HANDED_OVER',
      $or: [{ employeeId: { $exists: false } }, { employeeId: null }, { employeeId: employee.employeeId }],
    }, { $set: { employeeId: employee.employeeId } }, { new: true }).select('-guestToken').exec();
    if (session) return session;
    const existing = await this.sessions.exists({ _id: id, storeId: employee.storeId, status: 'HANDED_OVER' });
    if (existing) throw new ConflictException('Hội thoại đã được nhân viên khác tiếp nhận');
    throw new NotFoundException('Không tìm thấy hội thoại');
  }

  async sessionMessages(user: AuthUser, id: string) {
    await this.assignedSession(user, id);
    return this.messages.find({ sessionId: id }).sort({ createdAt: 1 }).exec();
  }

  async reply(user: AuthUser, id: string, content: string) {
    await this.assignedSession(user, id);
    const text = content.trim();
    if (!text) throw new BadRequestException('Nội dung tin nhắn không được để trống');
    const message = await this.messages.create({ sessionId: id, senderType: 'STAFF', content: text });
    await this.sessions.updateOne({ _id: id }, { $set: { lastMessageAt: new Date() } }).exec();
    return message;
  }

  async closeSession(user: AuthUser, id: string) {
    const { employee } = await this.assignedSession(user, id);
    const session = await this.sessions.findOneAndUpdate({
      _id: id, storeId: employee.storeId, employeeId: employee.employeeId, status: 'HANDED_OVER',
    }, { $set: { status: 'CLOSED', lastMessageAt: new Date() } }, { new: true }).select('-guestToken').exec();
    if (!session) throw new ConflictException('Hội thoại đã thay đổi trạng thái');
    return session;
  }

  private async employee(user: AuthUser) {
    // Đối chiếu lại hồ sơ để không tiếp tục dùng quyền cửa hàng cũ sau khi chuyển công tác.
    const employee = await this.employees.findOne({ userId: user.userId, storeId: user.storeId }).lean().exec();
    if (!employee || !user.storeId) throw new NotFoundException('Không tìm thấy cửa hàng của nhân viên');
    return employee;
  }

  private async assignedSession(user: AuthUser, id: string) {
    const employee = await this.employee(user);
    this.assertObjectId(id);
    const session = await this.sessions.findOne({
      _id: id, storeId: employee.storeId, employeeId: employee.employeeId, status: 'HANDED_OVER',
    }).select('-guestToken').lean().exec();
    if (!session) throw new NotFoundException('Không tìm thấy hội thoại đã tiếp nhận');
    return { employee, session };
  }

  private assertObjectId(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Không tìm thấy hội thoại');
  }
}
