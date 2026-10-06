import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AuthServiceModule } from './auth-service.module.js';
import { SERVICES_PORTS } from '@app/common';
import { LokiLogger } from '@app/loki';

async function bootstrap() {
  const port = Number(process.env.PORT ?? SERVICES_PORTS['auth-service'] ?? 3001);
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AuthServiceModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: port,
      },
    },
  );
  app.useLogger(new LokiLogger({ service: 'auth-service' }));
  await app.listen();
  console.log(`Auth Service is running as a TCP Microservice on port ${port}`);
}

await bootstrap();
