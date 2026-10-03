import { NestFactory } from '@nestjs/core';
import { TableServiceModule } from './table-service.module.js';
import { SERVICES_PORTS } from '@app/common';
import { join } from 'path';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const port = Number(process.env.PORT ?? SERVICES_PORTS['table-service'] ?? 50052);
  const protoPath = join(process.cwd(), 'libs/common/src/proto/table.proto');

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    TableServiceModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'table',
        protoPath: protoPath,
        url: `0.0.0.0:${port}`,
      },
    },
  );

  await app.listen();
  console.log(`Table Service is running as a gRPC Microservice on 0.0.0.0:${port}`);
}

await bootstrap();
