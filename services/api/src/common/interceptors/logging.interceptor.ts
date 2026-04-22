import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('HTTP');

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const req = context.switchToHttp().getRequest<Request>();
        const res = context.switchToHttp().getResponse<Response>();
        const { method, url } = req;
        const start = Date.now();

        return next.handle().pipe(
            tap({
                next: () => {
                    this.logger.log(`${method} ${url} ${res.statusCode} - ${Date.now() - start}ms`);
                },
                error: (err: unknown) => {
                    const status =
                        err instanceof Error && 'getStatus' in err
                            ? (err as { getStatus(): number }).getStatus()
                            : 500;
                    const message = err instanceof Error ? err.message : String(err);
                    this.logger.warn(
                        `${method} ${url} ${status} - ${Date.now() - start}ms - ${message}`
                    );
                }
            })
        );
    }
}
