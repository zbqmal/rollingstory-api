import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import * as bcrypt from 'bcrypt';
import type { Request, Response } from 'express';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  type CookieRequest = Request & { cookies?: Record<string, string> };
  type MockResponse = Response & {
    cookie: jest.Mock;
    clearCookie: jest.Mock;
  };

  const buildRequest = (options?: {
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  }): CookieRequest =>
    ({
      headers: options?.headers ?? {},
      cookies: options?.cookies,
    }) as CookieRequest;

  const expectAnyString = () => expect.any(String) as unknown as string;
  const expectAnyDate = () => expect.any(Date) as unknown as Date;
  const expectAnyNumber = () => expect.any(Number) as unknown as number;
  const expectObjectContaining = <T extends object>(value: T): T =>
    expect.objectContaining(value) as unknown as T;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    work: {
      count: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
    decode: jest.fn(),
  };

  const mockEmailService = {
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  };

  const mockRedis = {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
  };

  const mockRes: MockResponse = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as MockResponse;

  const mockReq = buildRequest();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
    };

    it('should successfully register a new user', async () => {
      const hashedPassword = 'hashedPassword123';
      const mockUser = {
        id: 'user-id',
        email: registerDto.email,
        username: registerDto.username,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockToken = 'jwt-token';

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue(mockToken);
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.register(registerDto, mockRes, mockReq);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(2);
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expectObjectContaining({
            email: registerDto.email,
            username: registerDto.username,
            password: hashedPassword,
            emailVerificationToken: expectAnyString(),
            emailVerificationTokenExpiresAt: expectAnyDate(),
          }),
        }),
      );
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(
        mockUser.email,
        expectAnyString(),
      );
      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
      });
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'access_token',
        mockToken,
        expect.objectContaining({ httpOnly: true }),
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expectAnyString(),
        expect.objectContaining({ httpOnly: true }),
      );
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          username: mockUser.username,
          createdAt: mockUser.createdAt,
        },
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'existing-user',
      });

      await expect(
        service.register(registerDto, mockRes, mockReq),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
    });

    it('should throw ConflictException if username already exists', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing-user' });

      await expect(
        service.register(registerDto, mockRes, mockReq),
      ).rejects.toThrow(ConflictException);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { username: registerDto.username },
      });
    });
  });

  describe('login', () => {
    const loginDto = {
      emailOrUsername: 'testuser',
      password: 'password123',
    };

    const mockUser = {
      id: 'user-id',
      email: 'test@example.com',
      username: 'testuser',
      password: 'hashedPassword',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should successfully login a user', async () => {
      const mockToken = 'jwt-token';

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue(mockToken);
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.login(loginDto, mockRes, mockReq);

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: loginDto.emailOrUsername },
            { username: loginDto.emailOrUsername },
          ],
        },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
      });
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'access_token',
        mockToken,
        expect.objectContaining({ httpOnly: true }),
      );
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          username: mockUser.username,
          createdAt: mockUser.createdAt,
        },
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.login(loginDto, mockRes, mockReq)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrismaService.user.findFirst).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto, mockRes, mockReq)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
    });
  });

  describe('refreshTokens', () => {
    const mockUser = {
      id: 'user-id',
      email: 'test@example.com',
      username: 'testuser',
      password: 'hashedPassword',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const rawToken = `${mockUser.id}.abcdef1234567890`;

    const mockStoredToken = {
      id: 'token-id',
      token: 'hashedRefreshToken',
      userId: mockUser.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    };

    it('should refresh tokens successfully', async () => {
      mockPrismaService.refreshToken.findMany.mockResolvedValue([
        mockStoredToken,
      ]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrismaService.refreshToken.delete.mockResolvedValue({});
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('new-access-token');
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshTokens(rawToken, mockRes, mockReq);

      expect(mockPrismaService.refreshToken.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, expiresAt: { gt: expectAnyDate() } },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        rawToken,
        mockStoredToken.token,
      );
      expect(mockPrismaService.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: mockStoredToken.id },
      });
      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
      });
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'access_token',
        'new-access-token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(result).toEqual({ message: 'Tokens refreshed' });
    });

    it('should throw UnauthorizedException if no refresh token provided', async () => {
      await expect(service.refreshTokens('', mockRes, mockReq)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token has no dot separator', async () => {
      await expect(
        service.refreshTokens('invalidtoken', mockRes, mockReq),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if refresh token not found', async () => {
      mockPrismaService.refreshToken.findMany.mockResolvedValue([
        mockStoredToken,
      ]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.refreshTokens(rawToken, mockRes, mockReq),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getCookieOptions / issueTokens cookie attributes', () => {
    const registerDto = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
    };
    const mockUser = {
      id: 'user-id',
      email: registerDto.email,
      username: registerDto.username,
      password: 'hashedPassword',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const setupRegisterMocks = () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('jwt-token');
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.refreshToken.create.mockResolvedValue({});
    };

    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('localhost:3000 in development → sameSite: lax, secure: false', async () => {
      process.env.NODE_ENV = 'development';
      setupRegisterMocks();
      const req = buildRequest({
        headers: { origin: 'http://localhost:3000' },
      });

      await service.register(registerDto, mockRes, req);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'access_token',
        expectAnyString(),
        expect.objectContaining({ sameSite: 'lax', secure: false }),
      );
    });

    it('web-dev.vercel.app in development → sameSite: none, secure: true', async () => {
      process.env.NODE_ENV = 'development';
      setupRegisterMocks();
      const req = buildRequest({
        headers: { origin: 'https://rollingstory-web-dev.vercel.app' },
      });

      await service.register(registerDto, mockRes, req);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'access_token',
        expectAnyString(),
        expect.objectContaining({ sameSite: 'none', secure: true }),
      );
    });

    it('web-prod.vercel.app in production → sameSite: none, secure: true', async () => {
      process.env.NODE_ENV = 'production';
      setupRegisterMocks();
      const req = buildRequest({
        headers: { origin: 'https://rollingstory-web-prod.vercel.app' },
      });

      await service.register(registerDto, mockRes, req);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'access_token',
        expectAnyString(),
        expect.objectContaining({ sameSite: 'none', secure: true }),
      );
    });

    it('localhost:3000 in production → sameSite: lax, secure: false', async () => {
      process.env.NODE_ENV = 'production';
      setupRegisterMocks();
      const req = buildRequest({
        headers: { origin: 'http://localhost:3000' },
      });

      await service.register(registerDto, mockRes, req);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'access_token',
        expectAnyString(),
        expect.objectContaining({ sameSite: 'lax', secure: false }),
      );
    });

    it('web-dev.vercel.app in production → sameSite: none, secure: true', async () => {
      process.env.NODE_ENV = 'production';
      setupRegisterMocks();
      const req = buildRequest({
        headers: { origin: 'https://rollingstory-web-dev.vercel.app' },
      });

      await service.register(registerDto, mockRes, req);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'access_token',
        expectAnyString(),
        expect.objectContaining({ sameSite: 'none', secure: true }),
      );
    });

    it('web-prod.vercel.app in development → sameSite: none, secure: true', async () => {
      process.env.NODE_ENV = 'development';
      setupRegisterMocks();
      const req = buildRequest({
        headers: { origin: 'https://rollingstory-web-prod.vercel.app' },
      });

      await service.register(registerDto, mockRes, req);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'access_token',
        expectAnyString(),
        expect.objectContaining({ sameSite: 'none', secure: true }),
      );
    });

    it('no origin header → sameSite: strict, secure: true', async () => {
      process.env.NODE_ENV = 'development';
      setupRegisterMocks();
      const req = buildRequest();

      await service.register(registerDto, mockRes, req);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'access_token',
        expectAnyString(),
        expect.objectContaining({ sameSite: 'strict', secure: true }),
      );
    });

    it('unknown origin → sameSite: strict, secure: true', async () => {
      process.env.NODE_ENV = 'development';
      setupRegisterMocks();
      const req = buildRequest({
        headers: { origin: 'https://unknown-site.example.com' },
      });

      await service.register(registerDto, mockRes, req);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'access_token',
        expectAnyString(),
        expect.objectContaining({ sameSite: 'strict', secure: true }),
      );
    });
  });

  describe('logout', () => {
    const mockStoredToken = {
      id: 'token-id',
      token: 'hashedRefreshToken',
      userId: 'user-id',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    };

    const rawToken = `user-id.abcdef1234567890`;

    it('should revoke all refresh tokens for the user and clear cookies', async () => {
      const req = buildRequest({ cookies: { refresh_token: rawToken } });

      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.logout(req, mockRes);

      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
      });
      expect(mockRes.clearCookie).toHaveBeenCalledWith('access_token', {
        path: '/',
      });
      expect(mockRes.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/',
      });
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('should clear cookies and return without DB access when no cookie', async () => {
      const req = buildRequest({ cookies: {} });

      const result = await service.logout(req, mockRes);

      expect(mockPrismaService.refreshToken.findMany).not.toHaveBeenCalled();
      expect(mockRes.clearCookie).toHaveBeenCalledWith('access_token', {
        path: '/',
      });
      expect(mockRes.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/',
      });
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('should store jti in Redis with correct TTL on logout', async () => {
      const now = Math.floor(Date.now() / 1000);
      const exp = now + 600; // 10 minutes remaining
      const jti = 'test-jti-uuid';
      const req = buildRequest({
        cookies: {
          access_token: 'valid.access.token',
          refresh_token: rawToken,
        },
      });

      mockJwtService.decode.mockReturnValue({ jti, exp });
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await service.logout(req, mockRes);

      expect(mockJwtService.decode).toHaveBeenCalledWith('valid.access.token');
      expect(mockRedis.set).toHaveBeenCalledWith(
        `denylist:${jti}`,
        '1',
        'EX',
        expectAnyNumber(),
      );
      const setCall = mockRedis.set.mock.calls[0] as [
        string,
        string,
        string,
        number,
      ];
      const ttlArg = setCall[3];
      expect(ttlArg).toBeGreaterThanOrEqual(1);
      expect(ttlArg).toBeLessThanOrEqual(600);
    });

    it('should skip Redis denylist if access_token cookie is absent', async () => {
      const req = buildRequest({ cookies: { refresh_token: rawToken } });

      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await service.logout(req, mockRes);

      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should still clear cookies and revoke refresh token when Redis fails', async () => {
      const now = Math.floor(Date.now() / 1000);
      const exp = now + 600;
      const req = buildRequest({
        cookies: {
          access_token: 'valid.access.token',
          refresh_token: rawToken,
        },
      });

      mockJwtService.decode.mockReturnValue({ jti: 'some-jti', exp });
      mockRedis.set.mockRejectedValueOnce(new Error('Redis unreachable'));
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.logout(req, mockRes);

      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
      });
      expect(mockRes.clearCookie).toHaveBeenCalledWith('access_token', {
        path: '/',
      });
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user data', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashedPassword',
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getCurrentUser('user-id');

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        isEmailVerified: mockUser.isEmailVerified,
        createdAt: mockUser.createdAt,
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getCurrentUser('non-existent-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('deleteAccount', () => {
    beforeEach(() => {
      mockPrismaService.work = {
        count: jest.fn(),
      };
    });

    it('should delete refresh tokens and user, clear cookies, and return success message', async () => {
      mockPrismaService.work.count.mockResolvedValue(0);
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 2 });
      mockPrismaService.user.delete.mockResolvedValue({});

      const result = await service.deleteAccount('user-id', mockRes);

      expect(mockPrismaService.work.count).toHaveBeenCalledWith({
        where: { authorId: 'user-id' },
      });
      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
      });
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-id' },
      });
      expect(mockRes.clearCookie).toHaveBeenCalledWith('access_token', {
        path: '/',
      });
      expect(mockRes.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/',
      });
      expect(result).toEqual({ message: 'Account deleted successfully' });
    });

    it('should throw ConflictException if user has authored works', async () => {
      mockPrismaService.work.count.mockResolvedValue(3);

      await expect(service.deleteAccount('user-id', mockRes)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.work.count).toHaveBeenCalledWith({
        where: { authorId: 'user-id' },
      });
      expect(mockPrismaService.refreshToken.deleteMany).not.toHaveBeenCalled();
      expect(mockPrismaService.user.delete).not.toHaveBeenCalled();
      expect(mockRes.clearCookie).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        isEmailVerified: false,
        emailVerificationToken: 'valid-token',
        emailVerificationTokenExpiresAt: new Date(Date.now() + 60000),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({});

      const result = await service.verifyEmail('valid-token');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          isEmailVerified: true,
          emailVerificationToken: null,
          emailVerificationTokenExpiresAt: null,
        },
      });
      expect(result).toEqual({ message: 'Email verified successfully' });
    });

    it('should throw BadRequestException if token not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.verifyEmail('bad-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if token is expired', async () => {
      const mockUser = {
        id: 'user-id',
        emailVerificationToken: 'expired-token',
        emailVerificationTokenExpiresAt: new Date(Date.now() - 60000),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.verifyEmail('expired-token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('resendVerification', () => {
    it('should send verification email to unverified user', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        isEmailVerified: false,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({});

      const result = await service.resendVerification('test@example.com');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expectObjectContaining({
            emailVerificationToken: expectAnyString(),
            emailVerificationTokenExpiresAt: expectAnyDate(),
          }),
        }),
      );
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(
        mockUser.email,
        expectAnyString(),
      );
      expect(result.message).toBeDefined();
    });

    it('should return 200 even if user not found (prevent enumeration)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.resendVerification('notexist@example.com');

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(result.message).toBeDefined();
    });

    it('should not send email if user is already verified', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        isEmailVerified: true,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.resendVerification('test@example.com');

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
      expect(result.message).toBeDefined();
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset email if user exists', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({});

      const result = await service.forgotPassword('test@example.com');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expectObjectContaining({
            passwordResetToken: expectAnyString(),
            passwordResetTokenExpiresAt: expectAnyDate(),
          }),
        }),
      );
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockUser.email,
        expectAnyString(),
      );
      expect(result.message).toBeDefined();
    });

    it('should return 200 even if user not found (prevent enumeration)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('notexist@example.com');

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(result.message).toBeDefined();
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const mockUser = {
        id: 'user-id',
        passwordResetToken: 'valid-reset-token',
        passwordResetTokenExpiresAt: new Date(Date.now() + 60000),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');
      mockPrismaService.user.update.mockResolvedValue({});

      const result = await service.resetPassword(
        'valid-reset-token',
        'newPassword1',
      );

      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword1', 12);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          password: 'newHashedPassword',
          passwordResetToken: null,
          passwordResetTokenExpiresAt: null,
        },
      });
      expect(result).toEqual({ message: 'Password reset successfully' });
    });

    it('should throw BadRequestException if token not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword('bad-token', 'newPassword1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if token is expired', async () => {
      const mockUser = {
        id: 'user-id',
        passwordResetToken: 'expired-token',
        passwordResetTokenExpiresAt: new Date(Date.now() - 60000),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.resetPassword('expired-token', 'newPassword1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
