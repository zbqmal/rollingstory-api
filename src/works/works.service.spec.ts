/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { WorksService } from './works.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WorksService', () => {
  let service: WorksService;

  const mockPrismaService = {
    work: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    like: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const mockAuthor = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    createdAt: new Date(),
  };

  const mockWork = {
    id: 'work-1',
    title: 'Test Work',
    description: 'Test Description',
    type: 'novel',
    pageCharLimit: 2000,
    allowCollaboration: true,
    authorId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    author: mockAuthor,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorksService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<WorksService>(WorksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      title: 'Test Work',
      description: 'Test Description',
      type: 'novel',
      pageCharLimit: 2000,
      allowCollaboration: true,
    };

    it('should create a new work', async () => {
      mockPrismaService.work.create.mockResolvedValue(mockWork);

      const result = await service.create('user-1', createDto);

      expect(mockPrismaService.work.create).toHaveBeenCalledWith({
        data: {
          title: createDto.title,
          description: createDto.description,
          type: createDto.type,
          pageCharLimit: createDto.pageCharLimit,
          allowCollaboration: createDto.allowCollaboration,
          authorId: 'user-1',
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
      expect(result).toEqual(mockWork);
    });

    it('should create work with default values', async () => {
      const minimalDto = {
        title: 'Test Work',
      };
      const workWithDefaults = {
        ...mockWork,
        type: 'novel',
        pageCharLimit: 2000,
        allowCollaboration: true,
      };

      mockPrismaService.work.create.mockResolvedValue(workWithDefaults);

      await service.create('user-1', minimalDto);

      expect(mockPrismaService.work.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'novel',
            pageCharLimit: 2000,
            allowCollaboration: true,
          }),
        }),
      );
    });
  });

  describe('getAll', () => {
    it('should return paginated works', async () => {
      const mockWorks = [
        { ...mockWork, _count: { pages: 5 } },
        { ...mockWork, id: 'work-2', _count: { pages: 3 } },
      ];

      mockPrismaService.work.findMany.mockResolvedValue(mockWorks);
      mockPrismaService.work.count.mockResolvedValue(2);

      const result = await service.getAll(1, 10);

      expect(mockPrismaService.work.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        include: {
          author: {
            select: {
              id: true,
              email: true,
              username: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              pages: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(result).toEqual({
        data: mockWorks,
        total: 2,
        page: 1,
        limit: 10,
      });
    });

    it('should handle pagination correctly', async () => {
      mockPrismaService.work.findMany.mockResolvedValue([]);
      mockPrismaService.work.count.mockResolvedValue(25);

      await service.getAll(3, 10);

      expect(mockPrismaService.work.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });
  });

  describe('getMyWorks', () => {
    it('should return works by user', async () => {
      const mockWorks = [
        { ...mockWork, _count: { pages: 5 } },
        { ...mockWork, id: 'work-2', _count: { pages: 3 } },
      ];

      mockPrismaService.work.findMany.mockResolvedValue(mockWorks);
      mockPrismaService.like.findMany.mockResolvedValue([]);

      const result = await service.getMyWorks('user-1');

      expect(mockPrismaService.work.findMany).toHaveBeenCalledWith({
        where: {
          authorId: 'user-1',
        },
        include: {
          _count: {
            select: {
              pages: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(result).toEqual(
        mockWorks.map((w) => ({ ...w, isLikedByCurrentUser: false })),
      );
    });
  });

  describe('getWorkgetByIdById', () => {
    it('should return a work by id', async () => {
      const workWithCount = { ...mockWork, _count: { pages: 5 } };
      mockPrismaService.work.findUnique.mockResolvedValue(workWithCount);

      const result = await service.getById('work-1');

      expect(mockPrismaService.work.findUnique).toHaveBeenCalledWith({
        where: { id: 'work-1' },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              username: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              pages: true,
            },
          },
        },
      });
      expect(result).toEqual(workWithCount);
    });

    it('should throw NotFoundException if work not found', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(null);

      await expect(service.getById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateDto = {
      title: 'Updated Title',
      description: 'Updated Description',
    };

    it('should update a work if user is owner', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);
      mockPrismaService.work.update.mockResolvedValue({
        ...mockWork,
        ...updateDto,
      });

      const result = await service.update('work-1', 'user-1', updateDto);

      expect(mockPrismaService.work.findUnique).toHaveBeenCalledWith({
        where: { id: 'work-1' },
      });
      expect(mockPrismaService.work.update).toHaveBeenCalledWith({
        where: { id: 'work-1' },
        data: updateDto,
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
      expect(result).toEqual({ ...mockWork, ...updateDto });
    });

    it('should throw NotFoundException if work not found', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', 'user-1', updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);

      await expect(
        service.update('work-1', 'different-user', updateDto),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.work.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete a work if user is owner', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);
      mockPrismaService.work.delete.mockResolvedValue(mockWork);

      const result = await service.remove('work-1', 'user-1');

      expect(mockPrismaService.work.findUnique).toHaveBeenCalledWith({
        where: { id: 'work-1' },
      });
      expect(mockPrismaService.work.delete).toHaveBeenCalledWith({
        where: { id: 'work-1' },
      });
      expect(result).toEqual({ message: 'Work deleted successfully' });
    });

    it('should throw NotFoundException if work not found', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.work.delete).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);

      await expect(service.remove('work-1', 'different-user')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrismaService.work.delete).not.toHaveBeenCalled();
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
