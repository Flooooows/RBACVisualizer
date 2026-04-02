import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithRequestId } from './request-id.middleware';

type ErrorPayload = {
  message: string;
  detail?: string;
  errors?: unknown;
  issues?: unknown;
};

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithRequestId>();
    const requestId = request.requestId ?? request.headers['x-request-id'] ?? null;

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = this.buildPayload(
      exception,
      status,
      request.url,
      typeof requestId === 'string' ? requestId : null,
    );

    const logEntry = {
      method: request.method,
      path: request.url,
      status,
      message: payload.message,
      detail: payload.detail,
      requestId,
      userAgent: request.headers['user-agent'] ?? null,
      ip: request.ip,
    };

    if (status >= 500) {
      this.logger.error(
        JSON.stringify(logEntry),
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(JSON.stringify(logEntry));
    }

    response.status(status).json(payload);
  }

  private buildPayload(
    exception: unknown,
    status: number,
    path: string,
    requestId: string | null,
  ): ErrorPayload & {
    statusCode: number;
    timestamp: string;
    path: string;
    requestId: string | null;
  } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return {
          statusCode: status,
          timestamp: new Date().toISOString(),
          path,
          requestId,
          message: response,
        };
      }

      if (typeof response === 'object' && response !== null) {
        const value = response as Record<string, unknown>;
        return {
          statusCode: status,
          timestamp: new Date().toISOString(),
          path,
          requestId,
          message: typeof value.message === 'string' ? value.message : exception.message,
          detail: typeof value.detail === 'string' ? value.detail : undefined,
          errors: value.errors,
          issues: value.issues,
        };
      }
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: new Date().toISOString(),
      path,
      requestId,
      message: 'Internal server error',
      detail: exception instanceof Error ? exception.message : undefined,
    };
  }
}
