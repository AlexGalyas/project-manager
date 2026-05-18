import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import type { Response } from 'express';

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof ZodValidationException) {
      status = exception.getStatus();
      code = 'VALIDATION_FAILED';
      message = 'Request payload failed validation';
      details = exception.getZodError().issues;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      code = HttpStatus[status] ?? 'HTTP_ERROR';
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as {
          message?: unknown;
          error?: unknown;
          details?: unknown;
          warnings?: unknown;
        };
        if (typeof b.message === 'string') message = b.message;
        else if (Array.isArray(b.message)) message = b.message.join('; ');
        if (typeof b.error === 'string') code = b.error.toUpperCase().replace(/\s+/g, '_');
        // Pass through any structured detail/warnings payload (e.g. Phase 7.5
        // assignment warnings on 422 responses) so clients can act on them.
        if (Array.isArray(b.warnings)) details = { warnings: b.warnings };
        if (b.details !== undefined) details = b.details;
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.stack ?? exception.message);
      message = exception.message;
    }

    const envelope: ErrorEnvelope = { error: { code, message } };
    if (details !== undefined) envelope.error.details = details;

    response.status(status).json(envelope);
  }
}
