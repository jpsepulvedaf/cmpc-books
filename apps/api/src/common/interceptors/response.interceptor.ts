import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

/**
 * Global response interceptor: wraps every successful payload in the shared
 * envelope `{ ok: true, data }`. Values that are already shaped as an envelope
 * (defensive) and streamable/empty responses pass through untouched.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        if (data === null || data === undefined) {
          return data;
        }
        if (
          typeof data === 'object' &&
          (data as Record<string, unknown>).__streamable__ === true
        ) {
          return data;
        }
        return { ok: true, data };
      }),
    );
  }
}