import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { LikesService } from './likes.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

describe('LikesService', () => {
  let service: LikesService;

  const mockPrismaService = {
    work: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    page: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    like: {
      create: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockWork = {
    id: 'work-1',
    title: 'Test Work',
    authorId: 'user-1',
    likesCount: 5,
  };

  const mockPage = {
    id: 'page-1',
    workId: 'work-1',
    authorId: 'user-1',
    content: 'Test content',
    pageNumber: 1,
    status: 'approved',
    likesCount: 3,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LikesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<LikesService>(LikesService);
    jest.clearAllMocks();
  });

  describe('likeWork', () => {
    it('should like a work and return updated likesCount with isLiked: true', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          like: { create: jest.fn().mockResolvedValue({}) },
          work: {
            update: jest.fn().mockResolvedValue({ ...mockWork, likesCount: 6 }),
          },
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return await callback(tx);
      });

      const result = await service.likeWork('work-1', 'user-2');

      expect(result).toEqual({ likesCount: 6, isLiked: true });
      expect(mockPrismaService.work.findUnique).toHaveBeenCalledWith({
        where: { id: 'work-1' },
      });
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when work does not exist', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(null);

      await expect(service.likeWork('non-existent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should throw ConflictException on duplicate like (P2002)', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint violation',
        { code: 'P2002', clientVersion: '5.0.0', meta: {} },
      );
      mockPrismaService.$transaction.mockRejectedValue(p2002Error);

      await expect(service.likeWork('work-1', 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('unlikeWork', () => {
    it('should unlike a work and return updated likesCount with isLiked: false', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          like: { delete: jest.fn().mockResolvedValue({}) },
          work: {
            update: jest.fn().mockResolvedValue({ ...mockWork, likesCount: 4 }),
          },
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return await callback(tx);
      });

      const result = await service.unlikeWork('work-1', 'user-2');

      expect(result).toEqual({ likesCount: 4, isLiked: false });
    });

    it('should throw NotFoundException when work does not exist', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(null);

      await expect(
        service.unlikeWork('non-existent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when like does not exist (P2025)', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);
      const p2025Error = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: '5.0.0', meta: {} },
      );
      mockPrismaService.$transaction.mockRejectedValue(p2025Error);

      await expect(service.unlikeWork('work-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should guard against likesCount going below 0', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue({
        ...mockWork,
        likesCount: 0,
      });
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          like: { delete: jest.fn().mockResolvedValue({}) },
          work: {
            update: jest
              .fn()
              .mockResolvedValue({ ...mockWork, likesCount: -1 }),
          },
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return await callback(tx);
      });

      const result = await service.unlikeWork('work-1', 'user-2');

      expect(result.likesCount).toBe(0);
      expect(result.isLiked).toBe(false);
    });
  });

  describe('likePage', () => {
    it('should like a page and return updated likesCount with isLiked: true', async () => {
      mockPrismaService.page.findUnique.mockResolvedValue(mockPage);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          like: { create: jest.fn().mockResolvedValue({}) },
          page: {
            update: jest.fn().mockResolvedValue({ ...mockPage, likesCount: 4 }),
          },
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return await callback(tx);
      });

      const result = await service.likePage('page-1', 'user-2');

      expect(result).toEqual({ likesCount: 4, isLiked: true });
      expect(mockPrismaService.page.findUnique).toHaveBeenCalledWith({
        where: { id: 'page-1' },
      });
    });

    it('should throw NotFoundException when page does not exist', async () => {
      mockPrismaService.page.findUnique.mockResolvedValue(null);

      await expect(service.likePage('non-existent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should throw ConflictException on duplicate like (P2002)', async () => {
      mockPrismaService.page.findUnique.mockResolvedValue(mockPage);
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint violation',
        { code: 'P2002', clientVersion: '5.0.0', meta: {} },
      );
      mockPrismaService.$transaction.mockRejectedValue(p2002Error);

      await expect(service.likePage('page-1', 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('unlikePage', () => {
    it('should unlike a page and return updated likesCount with isLiked: false', async () => {
      mockPrismaService.page.findUnique.mockResolvedValue(mockPage);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          like: { delete: jest.fn().mockResolvedValue({}) },
          page: {
            update: jest.fn().mockResolvedValue({ ...mockPage, likesCount: 2 }),
          },
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return await callback(tx);
      });

      const result = await service.unlikePage('page-1', 'user-2');

      expect(result).toEqual({ likesCount: 2, isLiked: false });
    });

    it('should throw NotFoundException when page does not exist', async () => {
      mockPrismaService.page.findUnique.mockResolvedValue(null);

      await expect(
        service.unlikePage('non-existent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when like does not exist (P2025)', async () => {
      mockPrismaService.page.findUnique.mockResolvedValue(mockPage);
      const p2025Error = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: '5.0.0', meta: {} },
      );
      mockPrismaService.$transaction.mockRejectedValue(p2025Error);

      await expect(service.unlikePage('page-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should guard against likesCount going below 0', async () => {
      mockPrismaService.page.findUnique.mockResolvedValue({
        ...mockPage,
        likesCount: 0,
      });
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          like: { delete: jest.fn().mockResolvedValue({}) },
          page: {
            update: jest
              .fn()
              .mockResolvedValue({ ...mockPage, likesCount: -1 }),
          },
        };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return await callback(tx);
      });

      const result = await service.unlikePage('page-1', 'user-2');

      expect(result.likesCount).toBe(0);
      expect(result.isLiked).toBe(false);
    });
  });
});
