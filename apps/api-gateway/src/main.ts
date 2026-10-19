import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { SERVICES_PORTS } from '@app/common';
import { LokiLogger } from '@app/loki';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(new LokiLogger({ service: 'api-gateway' }));
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  const port = Number(process.env.PORT ?? SERVICES_PORTS['api-gateway'] ?? 3000);
  await app.listen(port);
  console.log(`API Gateway is running on http://localhost:${port}`);
}

await bootstrap();
