import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.module';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('RedisService', () => {
  let service: RedisService;
  let quitMock: jest.Mock;
  let disconnectMock: jest.Mock;

  const RedisMock = Redis as unknown as jest.MockedClass<typeof Redis>;

  const createService = async (configValues?: Record<string, string>) => {
    const mockConfigService = {
      get: jest.fn((key: string) => {
        return configValues?.[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    return module.get<RedisService>(RedisService);
  };

  beforeEach(() => {
    quitMock = jest.fn().mockResolvedValue('OK');
    disconnectMock = jest.fn();
    RedisMock.mockImplementation(
      () =>
        ({ quit: quitMock, disconnect: disconnectMock }) as unknown as Redis,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a Redis client with configured URL', async () => {
    service = await createService({ REDIS_URL: 'redis://custom:6379' });

    expect(RedisMock).toHaveBeenCalledWith(
      'redis://custom:6379',
      expect.objectContaining({
        connectTimeout: 2000,
        commandTimeout: 1000,
        lazyConnect: true,
        enableOfflineQueue: false,
      }),
    );
    expect(service.client).toBeDefined();
  });

  it('uses default Redis URL when not configured', async () => {
    service = await createService({});

    expect(RedisMock).toHaveBeenCalledWith(
      'redis://localhost:6379',
      expect.objectContaining({
        connectTimeout: 2000,
        commandTimeout: 1000,
        lazyConnect: true,
        enableOfflineQueue: false,
      }),
    );
  });

  it('closes Redis connection via quit on module destroy', async () => {
    service = await createService();

    await service.onModuleDestroy();

    expect(quitMock).toHaveBeenCalled();
    expect(disconnectMock).not.toHaveBeenCalled();
  });

  it('falls back to disconnect when quit fails', async () => {
    quitMock.mockRejectedValueOnce(new Error('quit failed'));
    service = await createService();

    await service.onModuleDestroy();

    expect(quitMock).toHaveBeenCalled();
    expect(disconnectMock).toHaveBeenCalled();
  });
});
