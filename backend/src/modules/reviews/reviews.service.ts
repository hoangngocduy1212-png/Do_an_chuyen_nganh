import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ErrorCode } from '../../common/constants/error-codes';
import { Customer } from '../customers/schemas/customer.schema';
import { OrderItem } from '../order-items/schemas/order-item.schema';
import { Order } from '../orders/schemas/order.schema';
import { Product } from '../products/schemas/product.schema';
import { User } from '../users/schemas/user.schema';
import { CreateReviewDto } from './dto/review.dto';
import { Review } from './schemas/review.schema';

type Timestamped = { createdAt?: Date; updatedAt?: Date };

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private readonly reviews: Model<Review>,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(OrderItem.name) private readonly orderItems: Model<OrderItem>,
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(Customer.name) private readonly customers: Model<Customer>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  async forProduct(productId: string, page: number, limit: number) {
    const filter = { productId, isHidden: false };
    const [rows, total] = await Promise.all([
      this.reviews.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean<Array<Review & { _id: Types.ObjectId } & Timestamped>>().exec(),
      this.reviews.countDocuments(filter).exec(),
    ]);
    const customers = await this.customers.find({ customerId: { $in: rows.map((row) => row.customerId) } }).select('customerId userId').lean().exec();
    const users = await this.users.find({ userId: { $in: customers.map((customer) => customer.userId) } }).select('userId fullName').lean().exec();
    const nameByCustomer = new Map(customers.map((customer) => [customer.customerId, users.find((user) => user.userId === customer.userId)?.fullName ?? 'Khách hàng']));
    return {
      items: rows.map((row) => ({
        reviewId: String(row._id),
        userName: nameByCustomer.get(row.customerId) ?? 'Khách hàng',
        rating: row.rating,
        comment: row.comment,
        createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      })),
      total,
    };
  }

  async mine(userId: string, status: 'pending' | 'done' = 'pending') {
    const customer = await this.getCustomer(userId);
    if (status === 'done') {
      const rows = await this.reviews.find({ customerId: customer.customerId }).sort({ createdAt: -1 }).lean<Array<Review & { _id: Types.ObjectId } & Timestamped>>().exec();
      const products = await this.products.find({ productId: { $in: rows.map((row) => row.productId) } }).select('productId productName image').lean().exec();
      return rows.map((row) => {
        const product = products.find((item) => item.productId === row.productId);
        return {
          reviewId: String(row._id),
          orderId: row.orderId,
          productId: row.productId,
          productName: product?.productName ?? 'Sản phẩm',
          productImage: product?.image,
          rating: row.rating,
          comment: row.comment,
          createdAt: row.createdAt?.toISOString(),
          status: 'REVIEWED' as const,
        };
      });
    }
    const orders = await this.orders.find({ customerId: customer.customerId, orderStatus: 'DELIVERED' }).sort({ updatedAt: -1 }).limit(50).lean<Array<Order & { _id: Types.ObjectId } & Timestamped>>().exec();
    const orderIds = orders.map((order) => String(order._id));
    const [items, reviewed] = await Promise.all([
      this.orderItems.find({ orderId: { $in: orderIds } }).lean().exec(),
      this.reviews.find({ customerId: customer.customerId, orderId: { $in: orderIds } }).select('orderId productId').lean().exec(),
    ]);
    const reviewedKeys = new Set(reviewed.map((row) => `${row.orderId}:${row.productId}`));
    return orders.flatMap((order) => items
      .filter((item) => item.orderId === String(order._id) && !reviewedKeys.has(`${item.orderId}:${item.productId}`))
      .map((item) => ({
        reviewId: `${item.orderId}:${item.productId}`,
        orderId: item.orderId,
        productId: item.productId,
        productName: item.productName,
        productImage: item.image,
        deliveredAt: order.updatedAt?.toISOString(),
        status: 'PENDING' as const,
      })));
  }

  async create(userId: string, dto: CreateReviewDto) {
    const customer = await this.getCustomer(userId);
    if (!Types.ObjectId.isValid(dto.orderId)) throw new NotFoundException({ code: ErrorCode.ORDER_NOT_FOUND, message: 'Không tìm thấy đơn hàng' });
    const order = await this.orders.findById(dto.orderId).lean().exec();
    if (!order || order.customerId !== customer.customerId) throw new NotFoundException({ code: ErrorCode.ORDER_NOT_FOUND, message: 'Không tìm thấy đơn hàng' });
    if (order.orderStatus !== 'DELIVERED') throw new ForbiddenException({ code: ErrorCode.FORBIDDEN, message: 'Chỉ được đánh giá sản phẩm của đơn đã giao' });
    const item = await this.orderItems.findOne({ orderId: dto.orderId, productId: dto.productId }).lean().exec();
    if (!item) throw new NotFoundException({ code: ErrorCode.PRODUCT_NOT_FOUND, message: 'Sản phẩm không thuộc đơn hàng này' });

    let review;
    try {
      review = await this.reviews.create({ customerId: customer.customerId, orderId: dto.orderId, productId: dto.productId, rating: dto.rating, comment: dto.comment?.trim() ?? '' });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        throw new ConflictException({ code: ErrorCode.VALIDATION_ERROR, message: 'Bạn đã đánh giá sản phẩm này' });
      }
      throw error;
    }
    await this.refreshProductRating(dto.productId);
    return {
      reviewId: String(review._id),
      orderId: review.orderId,
      productId: review.productId,
      productName: item.productName,
      productImage: item.image,
      rating: review.rating,
      comment: review.comment,
      createdAt: (review as unknown as Timestamped).createdAt?.toISOString(),
      status: 'REVIEWED' as const,
    };
  }

  private async refreshProductRating(productId: string) {
    const [stats] = await this.reviews.aggregate<{ avg: number; count: number }>([
      { $match: { productId, isHidden: false } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]).exec();
    await this.products.updateOne({ productId }, { $set: { avgRating: stats ? Math.round(stats.avg * 10) / 10 : 0, reviewCount: stats?.count ?? 0 } }).exec();
  }

  private async getCustomer(userId: string) {
    const customer = await this.customers.findOne({ userId }).select('customerId').lean().exec();
    if (!customer) throw new NotFoundException({ code: ErrorCode.CUSTOMER_NOT_FOUND, message: 'Không tìm thấy hồ sơ khách hàng' });
    return customer;
  }
}
