import { Test, TestingModule } from '@nestjs/testing';
import { TokenCleanupService } from './token-cleanup.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TokenCleanupService', () => {
  let service: TokenCleanupService;

  const mockPrismaService = {
    refreshToken: {
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenCleanupService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TokenCleanupService>(TokenCleanupService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call deleteMany with expiresAt lt current date', async () => {
    mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 5 });

    await service.purgeExpiredRefreshTokens();

    expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
  });

  it('should log the count of deleted tokens', async () => {
    mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 3 });
    const logSpy = jest
      .spyOn(
        (service as unknown as { logger: { log: jest.Mock } }).logger,
        'log',
      )
      .mockImplementation(() => {});

    await service.purgeExpiredRefreshTokens();

    expect(logSpy).toHaveBeenCalledWith('Purged 3 expired refresh tokens');
  });
});
