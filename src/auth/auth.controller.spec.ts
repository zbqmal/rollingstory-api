import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { User } from '@prisma/client';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshTokens: jest.fn(),
    logout: jest.fn(),
    getCurrentUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
      };

      const serviceResult = {
        user: {
          id: 'user-id',
          email: registerDto.email,
          username: registerDto.username,
          createdAt: new Date(),
        },
      };

      const mockRes = { cookie: jest.fn() } as any;

      mockAuthService.register.mockResolvedValue(serviceResult);

      const result = await controller.register(registerDto, mockRes);

      expect(mockAuthService.register).toHaveBeenCalledWith(
        registerDto,
        mockRes,
      );
      expect(result).toEqual(serviceResult);
    });
  });

  describe('login', () => {
    it('should login a user', async () => {
      const loginDto: LoginDto = {
        emailOrUsername: 'testuser',
        password: 'password123',
      };

      const serviceResult = {
        user: {
          id: 'user-id',
          email: 'test@example.com',
          username: 'testuser',
          createdAt: new Date(),
        },
      };

      const mockRes = { cookie: jest.fn() } as any;

      mockAuthService.login.mockResolvedValue(serviceResult);

      const result = await controller.login(loginDto, mockRes);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto, mockRes);
      expect(result).toEqual(serviceResult);
    });
  });

  describe('refresh', () => {
    it('should call refreshTokens with cookie value', async () => {
      const rawToken = 'user-id.abcdef1234567890';
      const mockReq = {
        cookies: { refresh_token: rawToken },
      } as any;
      const mockRes = { cookie: jest.fn() } as any;

      mockAuthService.refreshTokens.mockResolvedValue({
        message: 'Tokens refreshed',
      });

      const result = await controller.refresh(mockReq, mockRes);

      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith(
        rawToken,
        mockRes,
      );
      expect(result).toEqual({ message: 'Tokens refreshed' });
    });
  });

  describe('logout', () => {
    it('should call authService.logout with request and response', async () => {
      const mockReq = {
        cookies: { refresh_token: 'user-id.abcdef1234567890' },
      } as any;
      const mockRes = { clearCookie: jest.fn() } as any;

      mockAuthService.logout.mockResolvedValue({
        message: 'Logged out successfully',
      });

      const result = await controller.logout(mockReq, mockRes);

      expect(mockAuthService.logout).toHaveBeenCalledWith(mockReq, mockRes);
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('getMe', () => {
    it('should return current user', async () => {
      const mockUser: User = {
        id: 'user-id',
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const expectedResult = {
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        createdAt: new Date(),
      };

      mockAuthService.getCurrentUser.mockResolvedValue(expectedResult);

      const result = await controller.getMe(mockUser);

      expect(mockAuthService.getCurrentUser).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(expectedResult);
    });
  });
});
