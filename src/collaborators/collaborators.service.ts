import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CollaboratorsService {
  constructor(private prisma: PrismaService) {}

  async requestCollaboration(workId: string, userId: string) {
    // Check if work exists
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
    });

    if (!work) {
      throw new NotFoundException('Work not found');
    }

    // Check if work has allowCollaboration: true
    if (!work.allowCollaboration) {
      throw new ForbiddenException(
        'Collaboration is not allowed for this work',
      );
    }

    // Check if user is not the work owner
    if (work.authorId === userId) {
      throw new ForbiddenException('You cannot collaborate on your own work');
    }

    // Check if there's already a collaboration record (pending or approved)
    const existingCollaboration =
      await this.prisma.workCollaborator.findUnique({
        where: {
          workId_userId: {
            workId,
            userId,
          },
        },
      });

    if (existingCollaboration) {
      if (existingCollaboration.approvedAt) {
        throw new ForbiddenException(
          'You are already a collaborator on this work',
        );
      } else {
        throw new ConflictException(
          'You already have a pending collaboration request',
        );
      }
    }

    // Create new WorkCollaborator record with null approvedAt (pending)
    const collaborationRequest = await this.prisma.workCollaborator.create({
      data: {
        workId,
        userId,
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

    return collaborationRequest;
  }

  async approveCollaborator(
    workId: string,
    userId: string,
    ownerId: string,
  ) {
    // Check if work exists
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
    });

    if (!work) {
      throw new NotFoundException('Work not found');
    }

    // Verify that ownerId is the work owner
    if (work.authorId !== ownerId) {
      throw new ForbiddenException(
        'Only the work owner can perform this action',
      );
    }

    // Check if collaboration request exists
    const collaborationRequest =
      await this.prisma.workCollaborator.findUnique({
        where: {
          workId_userId: {
            workId,
            userId,
          },
        },
      });

    if (!collaborationRequest) {
      throw new NotFoundException('Collaboration request not found');
    }

    // Check if it's pending
    if (collaborationRequest.approvedAt) {
      throw new ConflictException('Collaboration request is already approved');
    }

    // Update approvedAt timestamp to approve
    const approvedCollaborator = await this.prisma.workCollaborator.update({
      where: {
        workId_userId: {
          workId,
          userId,
        },
      },
      data: {
        approvedAt: new Date(),
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

    return approvedCollaborator;
  }

  async removeCollaborator(workId: string, userId: string, ownerId: string) {
    // Check if work exists
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
    });

    if (!work) {
      throw new NotFoundException('Work not found');
    }

    // Verify that ownerId is the work owner
    if (work.authorId !== ownerId) {
      throw new ForbiddenException(
        'Only the work owner can perform this action',
      );
    }

    // Check if collaboration exists
    const collaborator = await this.prisma.workCollaborator.findUnique({
      where: {
        workId_userId: {
          workId,
          userId,
        },
      },
    });

    if (!collaborator) {
      throw new NotFoundException('Collaborator not found');
    }

    // Delete the WorkCollaborator record
    await this.prisma.workCollaborator.delete({
      where: {
        workId_userId: {
          workId,
          userId,
        },
      },
    });

    return { message: 'Collaborator removed successfully' };
  }

  async getCollaborators(workId: string) {
    // Get all approved collaborators for the work
    const collaborators = await this.prisma.workCollaborator.findMany({
      where: {
        workId,
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
    });

    return collaborators;
  }

  async getPendingRequests(workId: string, ownerId: string) {
    // Check if work exists
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
    });

    if (!work) {
      throw new NotFoundException('Work not found');
    }

    // Verify that ownerId is the work owner
    if (work.authorId !== ownerId) {
      throw new ForbiddenException(
        'Only the work owner can perform this action',
      );
    }

    // Get all pending collaboration requests
    const pendingRequests = await this.prisma.workCollaborator.findMany({
      where: {
        workId,
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

    return pendingRequests;
  }
}
