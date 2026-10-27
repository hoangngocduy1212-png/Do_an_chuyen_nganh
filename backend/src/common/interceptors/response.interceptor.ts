import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs';

/** Boc ket qua thanh { success, data, meta } dung theo docs/api/API.md.
 *  Service co the tra ve { data, meta } de kem phan trang. */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((result) => {
        if (result && typeof result === 'object' && 'data' in result && 'meta' in result) {
          return { success: true, data: result.data, meta: result.meta };
        }
        return { success: true, data: result ?? null };
      }),
    );
  }
}
