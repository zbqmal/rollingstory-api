import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockRedis = {
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret-min-64-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'),
  };

  const mockUser = {
    id: 'user-id',
    email: 'test@example.com',
    username: 'testuser',
    password: 'hashedPassword',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should return user when jti is not denylisted', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await strategy.validate({
        sub: 'user-id',
        email: 'test@example.com',
        jti: 'valid-jti',
      });

      expect(mockRedis.get).toHaveBeenCalledWith('denylist:valid-jti');
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException when jti is denylisted', async () => {
      mockRedis.get.mockResolvedValue('1');

      await expect(
        strategy.validate({
          sub: 'user-id',
          email: 'test@example.com',
          jti: 'revoked-jti',
        }),
      ).rejects.toThrow(new UnauthorizedException('Token has been revoked'));

      expect(mockRedis.get).toHaveBeenCalledWith('denylist:revoked-jti');
      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should fail-open and allow request when Redis is unreachable', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection refused'));
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await strategy.validate({
        sub: 'user-id',
        email: 'test@example.com',
        jti: 'some-jti',
      });

      expect(result).toEqual(mockUser);
    });

    it('should skip denylist check when jti is absent', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await strategy.validate({
        sub: 'user-id',
        email: 'test@example.com',
      });

      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        strategy.validate({
          sub: 'non-existent-id',
          email: 'test@example.com',
          jti: 'some-jti',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
