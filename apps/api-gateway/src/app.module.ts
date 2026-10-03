import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { join } from 'path';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { SERVICES, SERVICES_PORTS, JwtStrategy } from '@app/common';

@Module({
  imports: [
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
  providers: [AppService, JwtStrategy],
})
export class AppModule {}
