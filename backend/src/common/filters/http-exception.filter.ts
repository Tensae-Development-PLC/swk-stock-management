import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'INTERNAL_SERVER_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else if (typeof payload === 'object' && payload !== null) {
        const body = payload as Record<string, unknown>;
        message = (body.message as string | string[]) ?? exception.message;
        error = (body.error as string) ?? exception.name;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = this.mapPrismaError(exception);
      status = mapped.status;
      message = mapped.message;
      error = mapped.error;
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.message, exception.stack);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private mapPrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
    error: string;
  } {
    if (exception.code === 'P2002') {
      const target = (exception.meta?.target as string[])?.join(', ') ?? 'field';
      if (target.includes('serialNumber')) {
        return {
          status: HttpStatus.CONFLICT,
          message: 'Serial number already exists.',
          error: 'CONFLICT',
        };
      }
      if (target.includes('bcNumber')) {
        return {
          status: HttpStatus.CONFLICT,
          message: 'BC number already exists.',
          error: 'CONFLICT',
        };
      }
      return {
        status: HttpStatus.CONFLICT,
        message: `A record with this ${target} already exists.`,
        error: 'CONFLICT',
      };
    }
    if (exception.code === 'P2025') {
      return {
        status: HttpStatus.NOT_FOUND,
        message: 'Record not found.',
        error: 'NOT_FOUND',
      };
    }
    if (exception.code === 'P2003') {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        message: 'Related record does not exist.',
        error: 'UNPROCESSABLE_ENTITY',
      };
    }
    return {
      status: HttpStatus.BAD_REQUEST,
      message: exception.message,
      error: 'BAD_REQUEST',
    };
  }
}
