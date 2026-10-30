import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable, NotFoundException } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Model } from 'mongoose';
import { ErrorCode } from '../../common/constants/error-codes';
import { Role } from '../../common/constants/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Customer } from '../customers/schemas/customer.schema';
import { AIFeedback } from './schemas/ai-feedback.schema';

export class CreateAiFeedbackDto {
  @IsIn(['CHATBOT', 'RECOMMENDATION']) feedbackType: string;
  @IsOptional() @IsString() messageId?: string;
  @IsOptional() @IsString() productId?: string;
  @IsBoolean() isHelpful: boolean;
  @IsOptional() @IsString() @MaxLength(500) comment?: string;
}

@Injectable()
export class AiFeedbackService {
  constructor(
    @InjectModel(AIFeedback.name) private readonly feedback: Model<AIFeedback>,
    @InjectModel(Customer.name) private readonly customers: Model<Customer>,
  ) {}

  async create(userId: string, dto: CreateAiFeedbackDto) {
    const customer = await this.customers.findOne({ userId }).select('customerId').lean().exec();
    if (!customer) throw new NotFoundException({ code: ErrorCode.CUSTOMER_NOT_FOUND, message: 'Không tìm thấy hồ sơ khách hàng' });
    const created = await this.feedback.create({ ...dto, customerId: customer.customerId, comment: dto.comment ?? '' });
    return { feedbackId: String(created._id) };
  }
}

@ApiTags('ai-feedback')
@ApiBearerAuth()
@Roles(Role.CUSTOMER)
@Controller('ai-feedback')
export class AiFeedbackController {
  constructor(private readonly service: AiFeedbackService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAiFeedbackDto) {
    return this.service.create(user.userId, dto);
  }
}
