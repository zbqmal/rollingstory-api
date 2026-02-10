import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WorksModule } from './works/works.module';
import { PagesModule } from './pages/pages.module';
import { CollaboratorsModule } from './collaborators/collaborators.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    WorksModule,
    PagesModule,
    CollaboratorsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
