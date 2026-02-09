/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';

describe('PagesController', () => {
  let controller: PagesController;

  const mockPagesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    password: 'hashed',
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
      expect(mockPagesService.create).toHaveBeenCalledWith(
        'work-1',
        'user-1',
        { content: 'Test content' },
      );
    });
  });

  describe('findAll', () => {
    it('should return all pages', async () => {
      const pages = [mockPage];
      mockPagesService.findAll.mockResolvedValue(pages);

      const result = await controller.findAll('work-1');

      expect(result).toEqual(pages);
      expect(mockPagesService.findAll).toHaveBeenCalledWith('work-1');
    });
  });

  describe('findOne', () => {
    it('should return a specific page', async () => {
      mockPagesService.findOne.mockResolvedValue(mockPage);

      const result = await controller.findOne('work-1', 1);

      expect(result).toEqual(mockPage);
      expect(mockPagesService.findOne).toHaveBeenCalledWith('work-1', 1);
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
      expect(mockPagesService.update).toHaveBeenCalledWith(
        'page-1',
        'user-1',
        { content: 'Updated content' },
      );
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
});
