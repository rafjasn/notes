import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger('ExceptionFilter');

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status: number;
        let message: string;
        let error: string;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const body = exception.getResponse();

            if (typeof body === 'object' && body !== null) {
                const b = body as Record<string, unknown>;
                message = Array.isArray(b['message'])
                    ? (b['message'] as string[]).join(', ')
                    : String(b['message'] ?? exception.message);
                error = String(b['error'] ?? HttpStatus[status] ?? 'Error');
            } else {
                message = String(body);
                error = HttpStatus[status] ?? 'Error';
            }
        } else {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
            error = 'Internal Server Error';
            message =
                process.env.NODE_ENV === 'production'
                    ? 'An unexpected error occurred'
                    : exception instanceof Error
                      ? exception.message
                      : String(exception);
            this.logger.error(
                exception instanceof Error ? exception.message : String(exception),
                exception instanceof Error ? exception.stack : undefined
            );
        }

        response.status(status).json({
            statusCode: status,
            error,
            message,
            timestamp: new Date().toISOString(),
            path: request.url
        });
    }
}
