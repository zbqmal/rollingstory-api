import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockEmailService = {
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  };

  const mockRes = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as any;

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
      mockPrismaService.user.update.mockResolvedValue({});
      mockJwtService.sign.mockReturnValue(mockToken);
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.register(registerDto, mockRes);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(2);
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email,
          username: registerDto.username,
          password: hashedPassword,
        },
      });
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'access_token',
        mockToken,
        expect.objectContaining({ httpOnly: true }),
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
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

      await expect(service.register(registerDto, mockRes)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
    });

    it('should throw ConflictException if username already exists', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing-user' });

      await expect(service.register(registerDto, mockRes)).rejects.toThrow(
        ConflictException,
      );
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
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.login(loginDto, mockRes);

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

      await expect(service.login(loginDto, mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrismaService.user.findFirst).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto, mockRes)).rejects.toThrow(
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
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshTokens(rawToken, mockRes);

      expect(mockPrismaService.refreshToken.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, expiresAt: { gt: expect.any(Date) } },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(rawToken, mockStoredToken.token);
      expect(mockPrismaService.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: mockStoredToken.id },
      });
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'access_token',
        'new-access-token',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(result).toEqual({ message: 'Tokens refreshed' });
    });

    it('should throw UnauthorizedException if no refresh token provided', async () => {
      await expect(service.refreshTokens('', mockRes)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token has no dot separator', async () => {
      await expect(
        service.refreshTokens('invalidtoken', mockRes),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if refresh token not found', async () => {
      mockPrismaService.refreshToken.findMany.mockResolvedValue([
        mockStoredToken,
      ]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.refreshTokens(rawToken, mockRes),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should delete all refresh tokens and clear cookies', async () => {
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.logout('user-id', mockRes);

      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
      });
      expect(mockRes.clearCookie).toHaveBeenCalledWith('access_token', {
        path: '/',
      });
      expect(mockRes.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/',
      });
      expect(result).toEqual({ message: 'Logged out' });
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user data', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashedPassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getCurrentUser('user-id');

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
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

  describe('verifyEmail', () => {
    const validUser = {
      id: 'user-id',
      email: 'test@example.com',
      emailVerifyToken: 'valid-token',
      emailVerifyExpiry: new Date(Date.now() + 10000),
    };

    it('should verify email with a valid token', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(validUser);
      mockPrismaService.user.update.mockResolvedValue({});

      const result = await service.verifyEmail('valid-token');

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          emailVerifyToken: 'valid-token',
          emailVerifyExpiry: { gt: expect.any(Date) },
        },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: validUser.id },
        data: {
          emailVerified: true,
          emailVerifyToken: null,
          emailVerifyExpiry: null,
        },
      });
      expect(result).toEqual({ message: 'Email verified successfully' });
    });

    it('should throw BadRequestException for an invalid token', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.verifyEmail('bad-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for an expired token', async () => {
      // findFirst returns null because expiry filter excludes expired tokens
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.verifyEmail('expired-token')).rejects.toThrow(
        new BadRequestException('Invalid or expired verification token'),
      );
    });
  });

  describe('forgotPassword', () => {
    const existingUser = {
      id: 'user-id',
      email: 'test@example.com',
    };

    it('should send reset email for an existing user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.update.mockResolvedValue({});

      const result = await service.forgotPassword('test@example.com');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: {
          resetPasswordToken: expect.any(String),
          resetPasswordExpiry: expect.any(Date),
        },
      });
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        existingUser.email,
        expect.any(String),
      );
      expect(result).toEqual({
        message: 'If that email exists, a reset link has been sent',
      });
    });

    it('should return the generic message without throwing for a non-existing email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('nobody@example.com');

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: 'If that email exists, a reset link has been sent',
      });
    });
  });

  describe('resetPassword', () => {
    const validUser = {
      id: 'user-id',
      email: 'test@example.com',
      resetPasswordToken: 'valid-reset-token',
      resetPasswordExpiry: new Date(Date.now() + 10000),
    };

    it('should reset the password with a valid token and strong password', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(validUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.resetPassword(
        'valid-reset-token',
        'StrongPass1!',
      );

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: validUser.id },
        data: {
          password: 'newHashedPassword',
          resetPasswordToken: null,
          resetPasswordExpiry: null,
        },
      });
      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: validUser.id },
      });
      expect(result).toEqual({ message: 'Password reset successfully' });
    });

    it('should throw BadRequestException for an invalid token', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword('bad-token', 'StrongPass1!'),
      ).rejects.toThrow(new BadRequestException('Invalid or expired reset token'));
    });

    it('should throw BadRequestException for an expired token', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword('expired-token', 'StrongPass1!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for a weak password', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(validUser);

      await expect(
        service.resetPassword('valid-reset-token', 'weakpassword'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
