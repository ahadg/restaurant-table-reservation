import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { SERVICES_PORTS } from '@app/common';
import { ReservationServiceModule } from './reservation-service.module.js';

async function bootstrap() {
  const port = Number(process.env.PORT ?? SERVICES_PORTS['reservation-service'] ?? 50053);
  const protoPath = join(process.cwd(), 'libs/common/src/proto/reservation.proto');

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    ReservationServiceModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'reservation',
        protoPath,
        url: `0.0.0.0:${port}`,
      },
    },
  );

  await app.listen();
  console.log(`Reservation Service is running as a gRPC Microservice on 0.0.0.0:${port}`);
}

await bootstrap();
