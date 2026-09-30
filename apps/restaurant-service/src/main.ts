import { NestFactory } from '@nestjs/core';
import { RestaurantServiceModule } from './restaurant-service.module.js';

async function bootstrap() {
  const app = await NestFactory.create(RestaurantServiceModule);
  await app.listen(process.env.port ?? 3000);
}
await bootstrap();
