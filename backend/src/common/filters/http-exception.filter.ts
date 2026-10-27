import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

/** Loi tra ve dung dinh dang { success:false, error:{ code, message } }. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Loi he thong';
    let code = HttpStatus[status] ?? 'ERROR';
    if (exception instanceof HttpException) {
      const body: any = exception.getResponse();
      message = Array.isArray(body?.message) ? body.message.join('; ') : (body?.message ?? exception.message);
      if (body?.code) code = body.code;
    }
    res.status(status).json({ success: false, error: { code, message } });
  }
}
