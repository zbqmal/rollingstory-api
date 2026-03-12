import { Test, TestingModule } from '@nestjs/testing';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';

describe('PagesController', () => {
  let controller: PagesController;

  const mockPagesService = {
    create: jest.fn(),
    getAllPages: jest.fn(),
    getByNumber: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getPendingContributions: jest.fn(),
    approveContribution: jest.fn(),
    rejectContribution: jest.fn(),
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    password: 'hashed',
    isEmailVerified: false,
    emailVerificationToken: null,
    emailVerificationTokenExpiresAt: null,
    passwordResetToken: null,
    passwordResetTokenExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPage = {
    id: 'page-1',
    workId: 'work-1',
    authorId: 'user-1',
    content: 'Test content',
    pageNumber: 1,
    createdAt: new Date(),
    author: {
      id: 'user-1',
      email: 'test@example.com',
      username: 'testuser',
      createdAt: new Date(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PagesController],
      providers: [
        {
          provide: PagesService,
          useValue: mockPagesService,
        },
      ],
    }).compile();

    controller = module.get<PagesController>(PagesController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a page', async () => {
      mockPagesService.create.mockResolvedValue(mockPage);

      const result = await controller.create('work-1', mockUser, {
        content: 'Test content',
      });

      expect(result).toEqual(mockPage);
      expect(mockPagesService.create).toHaveBeenCalledWith('work-1', 'user-1', {
        content: 'Test content',
      });
    });
  });

  describe('getAllPages', () => {
    it('should return all pages', async () => {
      const pages = [mockPage];
      mockPagesService.getAllPages.mockResolvedValue(pages);

      const result = await controller.getAllPages('work-1');

      expect(result).toEqual(pages);
      expect(mockPagesService.getAllPages).toHaveBeenCalledWith(
        'work-1',
        undefined,
      );
    });
  });

  describe('getByNumber', () => {
    it('should return a specific page', async () => {
      mockPagesService.getByNumber.mockResolvedValue(mockPage);

      const result = await controller.getByNumber('work-1', 1);

      expect(result).toEqual(mockPage);
      expect(mockPagesService.getByNumber).toHaveBeenCalledWith(
        'work-1',
        1,
        undefined,
      );
    });
  });

  describe('update', () => {
    it('should update a page', async () => {
      const updatedPage = { ...mockPage, content: 'Updated content' };
      mockPagesService.update.mockResolvedValue(updatedPage);

      const result = await controller.update('page-1', mockUser, {
        content: 'Updated content',
      });

      expect(result).toEqual(updatedPage);
      expect(mockPagesService.update).toHaveBeenCalledWith('page-1', 'user-1', {
        content: 'Updated content',
      });
    });
  });

  describe('remove', () => {
    it('should delete a page', async () => {
      const result = { message: 'Page deleted successfully' };
      mockPagesService.remove.mockResolvedValue(result);

      const response = await controller.remove('page-1', mockUser);

      expect(response).toEqual(result);
      expect(mockPagesService.remove).toHaveBeenCalledWith('page-1', 'user-1');
    });
  });

  describe('getPending', () => {
    it('should call getPendingContributions with workId and userId', async () => {
      const pages = [{ ...mockPage, status: 'pending' }];
      mockPagesService.getPendingContributions.mockResolvedValue(pages);

      const result = await controller.getPending('work-1', mockUser);

      expect(result).toEqual(pages);
      expect(mockPagesService.getPendingContributions).toHaveBeenCalledWith(
        'work-1',
        'user-1',
      );
    });
  });

  describe('approve', () => {
    it('should approve a pending contribution', async () => {
      const approvedPage = { ...mockPage, status: 'approved' };
      mockPagesService.approveContribution.mockResolvedValue(approvedPage);

      const result = await controller.approve('page-1', mockUser);

      expect(result).toEqual(approvedPage);
      expect(mockPagesService.approveContribution).toHaveBeenCalledWith(
        'page-1',
        'user-1',
      );
    });
  });

  describe('reject', () => {
    it('should reject a pending contribution', async () => {
      const deleteResult = {
        message: 'Contribution rejected and deleted successfully',
      };
      mockPagesService.rejectContribution.mockResolvedValue(deleteResult);

      const result = await controller.reject('page-1', mockUser);

      expect(result).toEqual(deleteResult);
      expect(mockPagesService.rejectContribution).toHaveBeenCalledWith(
        'page-1',
        'user-1',
      );
    });
  });
});
