import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ErrorCode } from '../../common/constants/error-codes';
import { Role } from '../../common/constants/roles';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { AiClientService } from '../ai-client/ai-client.service';
import { ChatMessage } from '../chat-messages/schemas/chat-message.schema';
import { ChatSession } from '../chat-sessions/schemas/chat-session.schema';
import { Customer } from '../customers/schemas/customer.schema';
import { Employee } from '../employees/schemas/employee.schema';
import { Order } from '../orders/schemas/order.schema';
import { Product } from '../products/schemas/product.schema';
import { User } from '../users/schemas/user.schema';

const HISTORY_LIMIT = 10;
const FALLBACK_ANSWER = 'Hiện trợ lý AI chưa phản hồi được. Bạn có thể chuyển sang nhân viên chăm sóc khách hàng để được hỗ trợ.';
const ROLES = { CUSTOMER: 'user', CHATBOT: 'assistant', STAFF: 'staff' } as const;

type MessageDoc = ChatMessage & { _id: Types.ObjectId };
type SessionDoc = ChatSession & { _id: Types.ObjectId };

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly ai: AiClientService,
    @InjectModel(ChatSession.name) private readonly sessions: Model<ChatSession>,
    @InjectModel(ChatMessage.name) private readonly messages: Model<ChatMessage>,
    @InjectModel(Customer.name) private readonly customers: Model<Customer>,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(Employee.name) private readonly employees: Model<Employee>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  async createSession(user?: AuthUser) {
    const customerId = await this.customerId(user);
    const session = await this.sessions.create({ customerId, status: 'AI_CHATTING', startedAt: new Date() });
    return { sessionId: String(session._id), status: session.status, startedAt: session.startedAt.toISOString() };
  }

  async sendMessage(sessionId: string, content: string, storeId: string | undefined, user?: AuthUser) {
    const session = await this.getSession(sessionId, user);
    const customerMessage = await this.messages.create({ sessionId, senderType: 'CUSTOMER', content });
    const now = new Date();
    if (session.status !== 'AI_CHATTING') {
      await this.sessions.updateOne({ _id: session._id }, { $set: { lastMessageAt: now } });
      return { answer: '', messageId: String(customerMessage._id), status: session.status };
    }

    const history = await this.messages.find({ sessionId, _id: { $ne: customerMessage._id } })
      .sort({ createdAt: -1 }).limit(HISTORY_LIMIT).lean<MessageDoc[]>().exec();
    let answer = FALLBACK_ANSWER;
    let sources: string[] = [];
    let needHandover = true;
    try {
      const result = await this.ai.chat({
        sessionId,
        message: content,
        storeId,
        history: history.reverse().map((item) => ({ role: ROLES[item.senderType], content: item.content })),
        customerContext: await this.customerContext(session.customerId),
      });
      ({ answer, sources, needHandover } = result);
    } catch (error) {
      this.logger.warn(`Chat AI failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const reply = await this.messages.create({ sessionId, senderType: 'CHATBOT', content: answer, sources, needHandover });
    await this.sessions.updateOne({ _id: session._id }, { $set: { lastMessageAt: new Date(), ...(storeId ? { storeId } : {}) } });
    return { answer, sources, needHandover, messageId: String(reply._id), products: [], status: session.status };
  }

  async history(sessionId: string, user?: AuthUser) {
    const session = await this.getSession(sessionId, user);
    const rows = await this.messages.find({ sessionId }).sort({ createdAt: 1 }).lean<MessageDoc[]>().exec();
    return { messages: rows.map(toMessageView), status: session.status, agentName: await this.agentName(session.employeeId) };
  }

  async handover(sessionId: string, user?: AuthUser) {
    const session = await this.getSession(sessionId, user);
    if (session.status === 'AI_CHATTING') {
      await this.sessions.updateOne({ _id: session._id }, { $set: { status: 'HANDED_OVER', handoverRequestedAt: new Date() } });
    }
    return { sessionId, status: session.status === 'AI_CHATTING' ? 'HANDED_OVER' : session.status, agentName: await this.agentName(session.employeeId) };
  }

  async mine(user: AuthUser) {
    const customerId = await this.customerId(user);
    if (!customerId) return [];
    const sessions = await this.sessions.find({ customerId }).sort({ startedAt: -1 }).limit(50).lean<SessionDoc[]>().exec();
    return Promise.all(sessions.map(async (session) => {
      const sessionId = String(session._id);
      const rows = await this.messages.find({ sessionId }).sort({ createdAt: 1 }).lean<MessageDoc[]>().exec();
      return {
        sessionId,
        status: session.status,
        startedAt: session.startedAt.toISOString(),
        agentName: await this.agentName(session.employeeId),
        messages: rows.map(toMessageView),
        lastMessage: rows.length ? toMessageView(rows[rows.length - 1]) : undefined,
      };
    }));
  }

  private async getSession(sessionId: string, user?: AuthUser): Promise<SessionDoc> {
    const session = Types.ObjectId.isValid(sessionId)
      ? await this.sessions.findById(sessionId).lean<SessionDoc>().exec()
      : null;
    if (!session) throw new NotFoundException({ code: ErrorCode.VALIDATION_ERROR, message: 'Không tìm thấy cuộc trò chuyện' });
    if (session.customerId && user?.role !== Role.ADMIN && user?.role !== Role.STAFF) {
      const customerId = await this.customerId(user);
      if (customerId !== session.customerId) {
        throw new ForbiddenException({ code: ErrorCode.FORBIDDEN, message: 'Bạn không có quyền truy cập cuộc trò chuyện này' });
      }
    }
    return session;
  }

  private async customerId(user?: AuthUser): Promise<string | undefined> {
    if (user?.role !== Role.CUSTOMER) return undefined;
    const customer = await this.customers.findOne({ userId: user.userId }).select('customerId').lean().exec();
    return customer?.customerId;
  }

  // Chỉ gửi thông tin đơn hàng không nhạy cảm cho AI.
  private async customerContext(customerId?: string): Promise<Record<string, unknown> | undefined> {
    if (!customerId) return undefined;
    const orders = await this.orders.find({ customerId }).sort({ createdAt: -1 }).limit(3)
      .select('orderCode orderStatus paymentStatus totalAmount receiveMethod').lean().exec();
    return { recentOrders: orders.map((order) => ({ orderCode: order.orderCode, status: order.orderStatus, paymentStatus: order.paymentStatus, totalAmount: order.totalAmount, receiveMethod: order.receiveMethod })) };
  }

  private async agentName(employeeId?: string): Promise<string | undefined> {
    if (!employeeId) return undefined;
    const employee = await this.employees.findOne({ employeeId }).select('userId').lean().exec();
    const user = employee ? await this.users.findOne({ userId: employee.userId }).select('fullName').lean().exec() : null;
    return user?.fullName;
  }
}

function toMessageView(message: MessageDoc) {
  return { id: String(message._id), role: ROLES[message.senderType], content: message.content };
}
