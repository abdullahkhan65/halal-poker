import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  const allowedOrigins = process.env.FRONTEND_URL
    ? [...process.env.FRONTEND_URL.split(','), 'http://localhost:5173']
    : ['http://localhost:5173'];
  app.enableCors({ origin: allowedOrigins, credentials: true });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
