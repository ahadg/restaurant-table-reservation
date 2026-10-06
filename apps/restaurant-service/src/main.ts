import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { RestaurantServiceModule } from './restaurant-service.module.js';
import { SERVICES_PORTS } from '@app/common';
import { LokiLogger } from '@app/loki';

async function bootstrap() {
  const port = Number(process.env.PORT ?? SERVICES_PORTS['restaurant-service'] ?? 50051);
  const protoPath = join(process.cwd(), 'libs/common/src/proto/restaurant.proto');

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    RestaurantServiceModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'restaurant',
        protoPath: protoPath,
        url: `0.0.0.0:${port}`,
      },
    },
  );

  app.useLogger(new LokiLogger({ service: 'restaurant-service' }));
  await app.listen();
  console.log(`Restaurant Service is running as a gRPC Microservice on 0.0.0.0:${port}`);
}

await bootstrap();
