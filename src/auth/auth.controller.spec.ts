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

      const expectedResult = {
        user: {
          id: 'user-id',
          email: registerDto.email,
          username: registerDto.username,
          createdAt: new Date(),
        },
        token: 'jwt-token',
      };

      mockAuthService.register.mockResolvedValue(expectedResult);

      const result = await controller.register(registerDto);

      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('login', () => {
    it('should login a user', async () => {
      const loginDto: LoginDto = {
        emailOrUsername: 'testuser',
        password: 'password123',
      };

      const expectedResult = {
        user: {
          id: 'user-id',
          email: 'test@example.com',
          username: 'testuser',
          createdAt: new Date(),
        },
        token: 'jwt-token',
      };

      mockAuthService.login.mockResolvedValue(expectedResult);

      const result = await controller.login(loginDto);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(expectedResult);
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
