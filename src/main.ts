import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(process.env.PORT || 3001);
  console.log(
    `Application is running on: http://localhost:${process.env.PORT || 3001}`,
  );
}
bootstrap().catch((err) => {
  console.error('Error starting application:', err);
  process.exit(1);
});
