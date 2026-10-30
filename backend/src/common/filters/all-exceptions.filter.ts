import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes';

interface ErrorResponseBody {
  code?: string;
  message?: string | string[];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? this.readBody(exception.getResponse()) : undefined;
    const code = body?.code ?? this.codeForStatus(status);
    const message = status === HttpStatus.INTERNAL_SERVER_ERROR
      ? 'Đã xảy ra lỗi hệ thống, vui lòng thử lại sau'
      : this.messageFor(status, body?.message, exception);

    if (status >= 500) this.logger.error('Lỗi nội bộ khi xử lý yêu cầu');
    response.status(status).json({ success: false, error: { code, message } });
  }

  private readBody(value: string | object): ErrorResponseBody | undefined {
    if (typeof value === 'string') return { message: value };
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as ErrorResponseBody;
    return undefined;
  }

  private codeForStatus(status: number): string {
    if (status === HttpStatus.BAD_REQUEST) return ErrorCode.VALIDATION_ERROR;
    if (status === HttpStatus.UNAUTHORIZED) return ErrorCode.UNAUTHORIZED;
    if (status === HttpStatus.FORBIDDEN) return ErrorCode.FORBIDDEN;
    if (status === HttpStatus.TOO_MANY_REQUESTS) return ErrorCode.TOO_MANY_REQUESTS;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) return ErrorCode.INTERNAL_ERROR;
    return `HTTP_${status}`;
  }

  private messageFor(status: number, message: string | string[] | undefined, exception: unknown): string {
    if (status === HttpStatus.BAD_REQUEST && Array.isArray(message)) return message.join('; ');
    if (status === HttpStatus.TOO_MANY_REQUESTS) return 'Bạn đã gửi quá nhiều yêu cầu, vui lòng thử lại sau';
    if (status === HttpStatus.NOT_FOUND) return typeof message === 'string' && message !== 'Not Found' ? message : 'Không tìm thấy tài nguyên được yêu cầu';
    if (status === HttpStatus.CONFLICT) return typeof message === 'string' && message !== 'Conflict' ? message : 'Dữ liệu bị xung đột';
    if (status === HttpStatus.UNAUTHORIZED && message === 'Unauthorized') return 'Vui lòng đăng nhập để tiếp tục';
    if (typeof message === 'string') return message;
    if (status === HttpStatus.UNAUTHORIZED) return 'Vui lòng đăng nhập để tiếp tục';
    if (status === HttpStatus.FORBIDDEN) return 'Bạn không có quyền thực hiện thao tác này';
    if (exception instanceof HttpException) return exception.message;
    return 'Yêu cầu không hợp lệ';
  }
}