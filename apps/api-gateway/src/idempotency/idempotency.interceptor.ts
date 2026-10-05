import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { RedisService } from '@app/redis';
import { createHash } from 'node:crypto';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { IDEMPOTENT_METADATA, type IdempotentOptions } from './idempotent.decorator.js';

type RequestWithUser = Request & { user?: { userId?: string; email?: string; role?: string } };

interface StoredRecord {
  status: 'IN_PROGRESS' | 'COMPLETED';
  requestHash: string;
  responseStatus?: number;
  responseBody?: unknown;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const options = this.reflector.get<Required<IdempotentOptions>>(
      IDEMPOTENT_METADATA,
      context.getHandler(),
    );
    if (!options) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithUser>();
    const response = http.getResponse<Response>();

    const headerKey = request.header('idempotency-key')?.trim();
    if (!headerKey) {
      if (options.required) {
        throw new BadRequestException('Idempotency-Key header is required for this endpoint');
      }
      return next.handle();
    }
    if (headerKey.length < 8 || headerKey.length > 255) {
      throw new BadRequestException('Idempotency-Key must be between 8 and 255 characters');
    }

    const userId = request.user?.userId ?? null;
    const method = request.method.toUpperCase();
    const path = request.originalUrl.split('?')[0];
    // Scope the key per user/method/path so one client cannot probe another's,
    // and so the same key on a different endpoint is a different operation.
    const cacheKey = `idempotency:${sha256(`${userId ?? 'anonymous'}|${method}|${path}|${headerKey}`)}`;
    const requestHash = sha256(JSON.stringify(request.body ?? null));

    let claimed: boolean;
    try {
      claimed = await this.redis.setIfAbsent(
        cacheKey,
        JSON.stringify({ status: 'IN_PROGRESS', requestHash } satisfies StoredRecord),
        options.ttlMs,
      );
    } catch (error) {
      // Fail open: a Redis outage must not take the endpoint down. The domain
      // still enforces its own uniqueness rules, so the only loss is replay
      // protection for the duration of the outage.
      this.logger.error(
        `Redis unavailable - proceeding WITHOUT idempotency protection for ${method} ${path}`,
        error as Error,
      );
      return next.handle();
    }

    if (!claimed) {
      return this.replay(cacheKey, requestHash, response);
    }

    const statusCode = this.resolveStatusCode(context, method);
    response.setHeader('Idempotency-Replayed', 'false');

    return next.handle().pipe(
      mergeMap((body) =>
        from(
          this.complete(
            cacheKey,
            { status: 'COMPLETED', requestHash, responseStatus: statusCode, responseBody: body },
            options.ttlMs,
          ),
        ).pipe(map(() => body)),
      ),
      catchError((error: unknown) =>
        // Release the claim so a genuine retry after a failure can proceed.
        from(this.release(cacheKey)).pipe(mergeMap(() => throwError(() => error))),
      ),
    );
  }

  /** The key already existed: return the stored response, or explain the conflict. */
  private async replay(
    cacheKey: string,
    requestHash: string,
    response: Response,
  ): Promise<Observable<unknown>> {
    let record: StoredRecord;
    try {
      const raw = await this.redis.get(cacheKey);
      if (!raw) {
        // Expired or deleted between the failed claim and this read.
        throw new ConflictException(
          'Idempotency-Key is currently being processed, retry shortly',
        );
      }
      record = JSON.parse(raw) as StoredRecord;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      // The store is unreadable, so we cannot tell whether this is a replay.
      // Executing could duplicate the side effect - refuse instead.
      this.logger.error(`Could not read idempotency record ${cacheKey}`, error as Error);
      throw new ServiceUnavailableException(
        'Idempotency store unavailable, retry shortly',
      );
    }

    if (record.status === 'IN_PROGRESS') {
      throw new ConflictException(
        'A request with this Idempotency-Key is already in progress',
      );
    }

    if (record.requestHash !== requestHash) {
      throw new UnprocessableEntityException(
        'This Idempotency-Key was already used with a different request payload',
      );
    }

    response.setHeader('Idempotency-Replayed', 'true');
    if (typeof record.responseStatus === 'number') {
      response.status(record.responseStatus);
    }
    return of(record.responseBody);
  }

  private async complete(cacheKey: string, record: StoredRecord, ttlMs: number): Promise<void> {
    try {
      await this.redis.set(cacheKey, JSON.stringify(record), ttlMs);
    } catch (error) {
      // The handler already succeeded; do not fail the response over bookkeeping.
      this.logger.error(
        `Failed to store idempotent response for ${cacheKey}; releasing the key`,
        error as Error,
      );
      await this.release(cacheKey);
    }
  }

  private async release(cacheKey: string): Promise<void> {
    try {
      await this.redis.del(cacheKey);
    } catch (error) {
      this.logger.error(`Failed to release idempotency key ${cacheKey}`, error as Error);
    }
  }

  /**
   * The status Nest is about to apply. Interceptors run before Nest writes the
   * status, so it has to be derived rather than read from the reply.
   */
  private resolveStatusCode(context: ExecutionContext, method: string): number {
    const explicit = this.reflector.get<number>(HTTP_CODE_METADATA, context.getHandler());
    if (typeof explicit === 'number') {
      return explicit;
    }
    return method === 'POST' ? 201 : 200;
  }
}
