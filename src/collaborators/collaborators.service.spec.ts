/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { CollaboratorsService } from './collaborators.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CollaboratorsService', () => {
  let service: CollaboratorsService;

  const mockPrismaService = {
    work: {
      findUnique: jest.fn(),
    },
    workCollaborator: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockWork = {
    id: 'work-1',
    title: 'Test Work',
    authorId: 'owner-1',
    allowCollaboration: true,
  };

  const mockUser = {
    id: 'user-1',
    email: 'user@example.com',
    username: 'testuser',
    createdAt: new Date(),
  };

  const mockCollaborator = {
    id: 'collab-1',
    workId: 'work-1',
    userId: 'user-1',
    approvedAt: null,
    user: mockUser,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaboratorsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CollaboratorsService>(CollaboratorsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestCollaboration', () => {
    it('should create a pending collaboration request', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);
      mockPrismaService.workCollaborator.findUnique.mockResolvedValue(null);
      mockPrismaService.workCollaborator.create.mockResolvedValue(
        mockCollaborator,
      );

      const result = await service.requestCollaboration('work-1', 'user-1');

      expect(result).toEqual(mockCollaborator);
      expect(mockPrismaService.workCollaborator.create).toHaveBeenCalledWith({
        data: {
          workId: 'work-1',
          userId: 'user-1',
          approvedAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              createdAt: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException if work not found', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(null);

      await expect(
        service.requestCollaboration('work-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if collaboration not allowed', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue({
        ...mockWork,
        allowCollaboration: false,
      });

      await expect(
        service.requestCollaboration('work-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user is the work owner', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);

      await expect(
        service.requestCollaboration('work-1', 'owner-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user is already an approved collaborator', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);
      mockPrismaService.workCollaborator.findUnique.mockResolvedValue({
        ...mockCollaborator,
        approvedAt: new Date(),
      });

      await expect(
        service.requestCollaboration('work-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if pending request already exists', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);
      mockPrismaService.workCollaborator.findUnique.mockResolvedValue(
        mockCollaborator,
      );

      await expect(
        service.requestCollaboration('work-1', 'user-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('approveCollaborator', () => {
    it('should approve a pending collaboration request', async () => {
      const approvedCollab = {
        ...mockCollaborator,
        approvedAt: new Date(),
      };
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);
      mockPrismaService.workCollaborator.findUnique.mockResolvedValue(
        mockCollaborator,
      );
      mockPrismaService.workCollaborator.update.mockResolvedValue(
        approvedCollab,
      );

      const result = await service.approveCollaborator(
        'work-1',
        'user-1',
        'owner-1',
      );

      expect(result.approvedAt).toBeTruthy();
      expect(mockPrismaService.workCollaborator.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if work not found', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(null);

      await expect(
        service.approveCollaborator('work-1', 'user-1', 'owner-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the work owner', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);

      await expect(
        service.approveCollaborator('work-1', 'user-1', 'not-owner'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if collaboration request not found', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);
      mockPrismaService.workCollaborator.findUnique.mockResolvedValue(null);

      await expect(
        service.approveCollaborator('work-1', 'user-1', 'owner-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if request already approved', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);
      mockPrismaService.workCollaborator.findUnique.mockResolvedValue({
        ...mockCollaborator,
        approvedAt: new Date(),
      });

      await expect(
        service.approveCollaborator('work-1', 'user-1', 'owner-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeCollaborator', () => {
    it('should remove a collaborator', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);
      mockPrismaService.workCollaborator.findUnique.mockResolvedValue(
        mockCollaborator,
      );
      mockPrismaService.workCollaborator.delete.mockResolvedValue(
        mockCollaborator,
      );

      const result = await service.removeCollaborator(
        'work-1',
        'user-1',
        'owner-1',
      );

      expect(result.message).toBe('Collaborator removed successfully');
      expect(mockPrismaService.workCollaborator.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if work not found', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(null);

      await expect(
        service.removeCollaborator('work-1', 'user-1', 'owner-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the work owner', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);

      await expect(
        service.removeCollaborator('work-1', 'user-1', 'not-owner'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if collaborator not found', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);
      mockPrismaService.workCollaborator.findUnique.mockResolvedValue(null);

      await expect(
        service.removeCollaborator('work-1', 'user-1', 'owner-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCollaborators', () => {
    it('should return all approved collaborators', async () => {
      const approvedCollabs = [
        { ...mockCollaborator, approvedAt: new Date() },
      ];
      mockPrismaService.workCollaborator.findMany.mockResolvedValue(
        approvedCollabs,
      );

      const result = await service.getCollaborators('work-1');

      expect(result).toEqual(approvedCollabs);
      expect(mockPrismaService.workCollaborator.findMany).toHaveBeenCalledWith(
        {
          where: {
            workId: 'work-1',
            approvedAt: {
              not: null,
            },
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                createdAt: true,
              },
            },
          },
        },
      );
    });
  });

  describe('getPendingRequests', () => {
    it('should return all pending requests', async () => {
      const pendingRequests = [mockCollaborator];
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);
      mockPrismaService.workCollaborator.findMany.mockResolvedValue(
        pendingRequests,
      );

      const result = await service.getPendingRequests('work-1', 'owner-1');

      expect(result).toEqual(pendingRequests);
      expect(mockPrismaService.workCollaborator.findMany).toHaveBeenCalledWith(
        {
          where: {
            workId: 'work-1',
            approvedAt: null,
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                createdAt: true,
              },
            },
          },
        },
      );
    });

    it('should throw NotFoundException if work not found', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(null);

      await expect(
        service.getPendingRequests('work-1', 'owner-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the work owner', async () => {
      mockPrismaService.work.findUnique.mockResolvedValue(mockWork);

      await expect(
        service.getPendingRequests('work-1', 'not-owner'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
