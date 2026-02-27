import { Injectable, Module, Global, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Provider } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    const url =
      this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.client = new Redis(url, {
      connectTimeout: 2000,
      commandTimeout: 1000,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}

const redisProvider: Provider<Redis> = {
  provide: REDIS_CLIENT,
  useFactory: (service: RedisService) => service.client,
  inject: [RedisService],
};

@Global()
@Module({
  providers: [RedisService, redisProvider],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
