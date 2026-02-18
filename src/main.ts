import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend
  app.enableCors({
    origin: [
      'https://rollingstory-api-prod.up.railway.app',
      'https://rollingstory-api-dev.up.railway.app',
      'http://localhost:3000', // for local development
    ],
    credentials: true,
  });

  // Health check endpoint
  app.getHttpAdapter().get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT || 3001);
  console.log(
    `Application is running on: http://localhost:${process.env.PORT || 3001}`,
  );
}
void bootstrap();
