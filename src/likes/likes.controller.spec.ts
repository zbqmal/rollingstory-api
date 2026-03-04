import { Test, TestingModule } from '@nestjs/testing';
import { LikesController } from './likes.controller';
import { LikesService } from './likes.service';

describe('LikesController', () => {
  let controller: LikesController;

  const mockLikesService = {
    likeWork: jest.fn(),
    unlikeWork: jest.fn(),
    likePage: jest.fn(),
    unlikePage: jest.fn(),
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    password: 'hashedPassword',
    isEmailVerified: false,
    emailVerificationToken: null,
    emailVerificationTokenExpiresAt: null,
    passwordResetToken: null,
    passwordResetTokenExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LikesController],
      providers: [
        {
          provide: LikesService,
          useValue: mockLikesService,
        },
      ],
    }).compile();

    controller = module.get<LikesController>(LikesController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('likeWork', () => {
    it('should like a work and return response', async () => {
      const response = { likesCount: 10, isLiked: true };
      mockLikesService.likeWork.mockResolvedValue(response);

      const result = await controller.likeWork('work-1', mockUser);

      expect(result).toEqual(response);
      expect(mockLikesService.likeWork).toHaveBeenCalledWith(
        'work-1',
        'user-1',
      );
    });
  });

  describe('unlikeWork', () => {
    it('should unlike a work and return response', async () => {
      const response = { likesCount: 9, isLiked: false };
      mockLikesService.unlikeWork.mockResolvedValue(response);

      const result = await controller.unlikeWork('work-1', mockUser);

      expect(result).toEqual(response);
      expect(mockLikesService.unlikeWork).toHaveBeenCalledWith(
        'work-1',
        'user-1',
      );
    });
  });

  describe('likePage', () => {
    it('should like a page and return response', async () => {
      const response = { likesCount: 5, isLiked: true };
      mockLikesService.likePage.mockResolvedValue(response);

      const result = await controller.likePage('work-1', 1, mockUser);

      expect(result).toEqual(response);
      expect(mockLikesService.likePage).toHaveBeenCalledWith(
        'work-1',
        1,
        'user-1',
      );
    });
  });

  describe('unlikePage', () => {
    it('should unlike a page and return response', async () => {
      const response = { likesCount: 4, isLiked: false };
      mockLikesService.unlikePage.mockResolvedValue(response);

      const result = await controller.unlikePage('work-1', 1, mockUser);

      expect(result).toEqual(response);
      expect(mockLikesService.unlikePage).toHaveBeenCalledWith(
        'work-1',
        1,
        'user-1',
      );
    });
  });
});
