import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { kafkaMicroserviceOptions } from '@app/kafka';
import { EmailServiceModule } from './email-service.module.js';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    EmailServiceModule,
    kafkaMicroserviceOptions('email-service'),
  );
  await app.listen();
  console.log('Email Service Kafka consumer is running');
}

await bootstrap();
