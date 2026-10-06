import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { join } from 'path';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { IdempotencyInterceptor } from './idempotency/idempotency.interceptor.js';
import { RateLimitGuard } from './rate-limit/rate-limit.guard.js';
import { RedisThrottlerStorage } from './rate-limit/redis-throttler.storage.js';
import { SERVICES, SERVICES_PORTS, JwtStrategy } from '@app/common';
import { RedisModule, RedisService } from '@app/redis';

@Module({
  imports: [
    RedisModule,
    // Global default limit; individual routes tighten it with @Throttle().
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
        storage: new RedisThrottlerStorage(redis),
        errorMessage: 'Too many requests. Please slow down.',
      }),
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secretKey',
      signOptions: { expiresIn: '1d' },
    }),
    ClientsModule.register([
      {
        name: SERVICES.AUTH_SERVICE,
        transport: Transport.TCP,
        options: {
          host: process.env.AUTH_SERVICE_HOST || '127.0.0.1',
          port: Number(process.env.AUTH_SERVICE_PORT || SERVICES_PORTS['auth-service'] || 3001),
        },
      },
      {
        name: SERVICES.NOTIFICATION_SERVICE,
        transport: Transport.TCP,
        options: {
          host: process.env.NOTIFICATION_SERVICE_HOST || '127.0.0.1',
          port: Number(process.env.NOTIFICATION_SERVICE_PORT || SERVICES_PORTS['notification-service'] || 3003),
        },
      },
      {
        name: SERVICES.RESTAURANT_SERVICE,
        transport: Transport.GRPC,
        options: {
          package: 'restaurant',
          protoPath: join(process.cwd(), 'libs/common/src/proto/restaurant.proto'),
          url: process.env.RESTAURANT_SERVICE_URL || `127.0.0.1:${SERVICES_PORTS['restaurant-service'] || 50051}`,
        },
      },
      {
        name: SERVICES.TABLE_SERVICE,
        transport: Transport.GRPC,
        options: {
          package: 'table',
          protoPath: join(process.cwd(), 'libs/common/src/proto/table.proto'),
          url: process.env.TABLE_SERVICE_URL || `127.0.0.1:${SERVICES_PORTS['table-service'] || 50052}`,
        },
      },
      {
        name: SERVICES.RESERVATION_SERVICE,
        transport: Transport.GRPC,
        options: {
          package: 'reservation',
          protoPath: join(process.cwd(), 'libs/common/src/proto/reservation.proto'),
          url: process.env.RESERVATION_SERVICE_URL || `127.0.0.1:${SERVICES_PORTS['reservation-service'] || 50053}`,
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtStrategy,
    // Guards run before interceptors, so throttling is evaluated first and can
    // reject a request before it reaches the idempotency layer.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
