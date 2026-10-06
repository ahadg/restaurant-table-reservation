import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { kafkaMicroserviceOptions } from '@app/kafka';
import { EmailServiceModule } from './email-service.module.js';
import { LokiLogger } from '@app/loki';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    EmailServiceModule,
    kafkaMicroserviceOptions('email-service'),
  );
  app.useLogger(new LokiLogger({ service: 'email-service' }));
  await app.listen();
  console.log('Email Service Kafka consumer is running');
}

await bootstrap();
