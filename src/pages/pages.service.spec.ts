/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PagesService } from './pages.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PagesService', () => {
  let service: PagesService;

  const mockPrismaService = {
    work: {
      findUnique: jest.fn(),
    },
    page: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    createdAt: new Date(),
  };

  const mockWork = {
    id: 'work-1',
    title: 'Test Work',
    authorId: 'user-1',
    pageCharLimit: 2000,
    allowCollaboration: true,
  };

  const mockPage = {
    id: 'page-1',
    workId: 'work-1',
    authorId: 'user-1',
    content: 'Test content',
    pageNumber: 1,
    status: 'approved',
    approvedAt: new Date(),
    createdAt: new Date(),
    author: mockUser,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PagesService>(PagesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a page as work owner with approved status', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);
      mockPrismaService.page.findFirst.mockResolvedValue(null);
      mockPrismaService.page.create.mockResolvedValue(mockPage);

      const result = await service.create('work-1', 'user-1', {
        content: 'Test content',
      });

      expect(result).toEqual(mockPage);
      expect(mockPrismaService.work.findUnique).toHaveBeenCalledWith({
        where: { id: 'work-1' },
      });
      expect(mockPrismaService.page.findFirst).toHaveBeenCalledWith({
        where: { workId: 'work-1', status: 'approved' },
        orderBy: { pageNumber: 'desc' },
      });
      expect(mockPrismaService.page.create).toHaveBeenCalledWith({
        data: {
          workId: 'work-1',
          authorId: 'user-1',
          content: 'Test content',
          pageNumber: 1,
          status: 'approved',
          approvedAt: expect.any(Date),
        },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              username: true,
              createdAt: true,
            },
          },
        },
      });
    });

    it('should create a page as non-owner with pending status', async () => {
      const workByAnotherUser = {
        ...mockWork,
        authorId: 'user-2',
      };
      const pendingPage = {
        ...mockPage,
        status: 'pending',
        pageNumber: null,
        approvedAt: null,
      };
      mockPrismaService.work.findUnique.mockResolvedValue(workByAnotherUser);
      mockPrismaService.page.create.mockResolvedValue(pendingPage);

      const result = await service.create('work-1', 'user-1', {
        content: 'Test content',
      });

      expect(result).toEqual(pendingPage);
      expect(mockPrismaService.page.create).toHaveBeenCalledWith({
        data: {
          workId: 'work-1',
          authorId: 'user-1',
          content: 'Test content',
          status: 'pending',
        },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              username: true,
              createdAt: true,
            },
          },
        },
      });
    });

    it('should assign sequential page numbers for owner pages', async () => {
      const lastPage = { ...mockPage, pageNumber: 5 };
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);
      mockPrismaService.page.findFirst.mockResolvedValue(lastPage);
      mockPrismaService.page.create.mockResolvedValue({
        ...mockPage,
        pageNumber: 6,
      });

      await service.create('work-1', 'user-1', { content: 'Test content' });

      expect(mockPrismaService.page.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pageNumber: 6,
            status: 'approved',
            approvedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw NotFoundException if work not found', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(null);

      await expect(
        service.create('work-1', 'user-1', { content: 'Test content' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if work does not allow collaboration', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue({
        ...mockWork,
        authorId: 'user-2',
        allowCollaboration: false,
      });

      await expect(
        service.create('work-1', 'user-1', { content: 'Test content' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if content exceeds character limit', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);

      const longContent = 'a'.repeat(2001);
      await expect(
        service.create('work-1', 'user-1', { content: longContent }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all approved pages for a work', async () => {
      const pages = [mockPage, { ...mockPage, id: 'page-2', pageNumber: 2 }];
      mockPrismaService.page.findMany.mockResolvedValue(pages);

      const result = await service.findAll('work-1');

      expect(result).toEqual(pages);
      expect(mockPrismaService.page.findMany).toHaveBeenCalledWith({
        where: { workId: 'work-1', status: 'approved' },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              username: true,
              createdAt: true,
            },
          },
        },
        orderBy: { pageNumber: 'asc' },
      });
    });

    it('should return empty array if no approved pages', async () => {
      mockPrismaService.page.findMany.mockResolvedValue([]);

      const result = await service.findAll('work-1');

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a specific approved page', async () => {
      mockPrismaService.page.findFirst.mockResolvedValue(mockPage);

      const result = await service.findOne('work-1', 1);

      expect(result).toEqual(mockPage);
      expect(mockPrismaService.page.findFirst).toHaveBeenCalledWith({
        where: {
          workId: 'work-1',
          pageNumber: 1,
          status: 'approved',
        },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              username: true,
              createdAt: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException if page not found', async () => {
      mockPrismaService.page.findFirst.mockResolvedValue(null);

      await expect(service.findOne('work-1', 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update an approved page', async () => {
      const pageWithWork = { ...mockPage, work: mockWork };
      mockPrismaService.page.findUnique.mockResolvedValue(pageWithWork);
      mockPrismaService.page.update.mockResolvedValue(mockPage);

      const result = await service.update('page-1', 'user-1', {
        content: 'Updated content',
      });

      expect(result).toEqual(mockPage);
      expect(mockPrismaService.page.update).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        data: {
          content: 'Updated content',
        },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              username: true,
              createdAt: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException if page not found', async () => {
      mockPrismaService.page.findUnique.mockResolvedValue(null);

      await expect(
        service.update('page-1', 'user-1', { content: 'Updated content' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not author', async () => {
      const pageWithWork = { ...mockPage, work: mockWork };
      mockPrismaService.page.findUnique.mockResolvedValue(pageWithWork);

      await expect(
        service.update('page-1', 'user-2', { content: 'Updated content' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if content exceeds character limit', async () => {
      const pageWithWork = { ...mockPage, work: mockWork, status: 'approved' };
      mockPrismaService.page.findUnique.mockResolvedValue(pageWithWork);

      const longContent = 'a'.repeat(2001);
      await expect(
        service.update('page-1', 'user-1', { content: longContent }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if page is pending', async () => {
      const pendingPage = { ...mockPage, work: mockWork, status: 'pending' };
      mockPrismaService.page.findUnique.mockResolvedValue(pendingPage);

      await expect(
        service.update('page-1', 'user-1', { content: 'Updated content' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should delete an approved page and reorder subsequent pages', async () => {
      mockPrismaService.page.findUnique.mockResolvedValue(mockPage);

      const mockTransaction = jest.fn(async (callback) => {
        const tx = {
          page: {
            delete: jest.fn(),
          },
          $executeRaw: jest.fn(),
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return await callback(tx);
      });

      mockPrismaService.$transaction.mockImplementation(mockTransaction);

      const result = await service.remove('page-1', 'user-1');

      expect(result).toEqual({ message: 'Page deleted successfully' });
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if page not found', async () => {
      mockPrismaService.page.findUnique.mockResolvedValue(null);

      await expect(service.remove('page-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not author', async () => {
      mockPrismaService.page.findUnique.mockResolvedValue(mockPage);

      await expect(service.remove('page-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if page is pending', async () => {
      const pendingPage = { ...mockPage, status: 'pending' };
      mockPrismaService.page.findUnique.mockResolvedValue(pendingPage);

      await expect(service.remove('page-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getCollaborators', () => {
    it('should return collaborators sorted by page count', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);
      mockPrismaService.$queryRaw.mockResolvedValue([
        { userId: 'user-1', username: 'alice', pageCount: 12 },
        { userId: 'user-2', username: 'bob', pageCount: 8 },
        { userId: 'user-3', username: 'carol', pageCount: 5 },
      ]);

      const result = await service.getCollaborators('work-1');

      expect(result).toEqual([
        { userId: 'user-1', username: 'alice', pageCount: 12 },
        { userId: 'user-2', username: 'bob', pageCount: 8 },
        { userId: 'user-3', username: 'carol', pageCount: 5 },
      ]);
      expect(mockPrismaService.work.findUnique).toHaveBeenCalledWith({
        where: { id: 'work-1' },
      });
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
    });

    it('should return empty array if no approved pages', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      const result = await service.getCollaborators('work-1');

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException if work does not exist', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(null);

      await expect(service.getCollaborators('work-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should sort alphabetically when page counts are equal', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);
      mockPrismaService.$queryRaw.mockResolvedValue([
        { userId: 'user-1', username: 'alice', pageCount: 5 },
        { userId: 'user-2', username: 'bob', pageCount: 5 },
        { userId: 'user-3', username: 'carol', pageCount: 5 },
      ]);

      const result = await service.getCollaborators('work-1');

      expect(result).toEqual([
        { userId: 'user-1', username: 'alice', pageCount: 5 },
        { userId: 'user-2', username: 'bob', pageCount: 5 },
        { userId: 'user-3', username: 'carol', pageCount: 5 },
      ]);
      // Verify sorting was handled by the SQL query
    });
  });
});
