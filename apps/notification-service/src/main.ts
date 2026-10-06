import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { SERVICES_PORTS } from '@app/common';
import { kafkaMicroserviceOptions } from '@app/kafka';
import { NotificationServiceModule } from './notification-service.module.js';
import { LokiLogger } from '@app/loki';

async function bootstrap() {
  const port = Number(process.env.PORT ?? SERVICES_PORTS['notification-service'] ?? 3003);
  const app = await NestFactory.create(NotificationServiceModule);
  app.useLogger(new LokiLogger({ service: 'notification-service' }));

  app.connectMicroservice({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port,
    },
  });
  app.connectMicroservice(kafkaMicroserviceOptions('notification-service'));

  await app.startAllMicroservices();
  console.log(`Notification Service TCP on ${port} and Kafka consumer ready`);
}

await bootstrap();
