import { NestFactory } from '@nestjs/core';
import { TableServiceModule } from './table-service.module.js';

async function bootstrap() {
  const app = await NestFactory.create(TableServiceModule);
  await app.listen(process.env.port ?? 3000);
}
await bootstrap();
