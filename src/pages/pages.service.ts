import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';

@Injectable()
export class PagesService {
  constructor(private prisma: PrismaService) {}

  async create(workId: string, userId: string, dto: CreatePageDto) {
    // Verify work exists and check authorization
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
    });

    if (!work) {
      throw new NotFoundException('Work not found');
    }

    // Check if user is owner
    const isOwner = work.authorId === userId;

    // Only check allowCollaboration for non-owners
    if (!isOwner && !work.allowCollaboration) {
      throw new ForbiddenException(
        'This work does not allow contributions',
      );
    }

    // Validate content length against work's pageCharLimit
    if (dto.content.length > work.pageCharLimit) {
      throw new BadRequestException(
        `Content exceeds the work's character limit of ${work.pageCharLimit}`,
      );
    }

    // If owner: Create with status = "approved", assign pageNumber, set approvedAt
    // If not owner: Create with status = "pending", pageNumber = null, approvedAt = null
    if (isOwner) {
      // Get the next page number for approved pages
      const lastPage = await this.prisma.page.findFirst({
        where: { workId, status: 'approved' },
        orderBy: { pageNumber: 'desc' },
      });

      const nextPageNumber = lastPage ? lastPage.pageNumber + 1 : 1;

      // Create approved page
      const page = await this.prisma.page.create({
        data: {
          workId,
          authorId: userId,
          content: dto.content,
          pageNumber: nextPageNumber,
          status: 'approved',
          approvedAt: new Date(),
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

      return page;
    } else {
      // Create pending page (no pageNumber yet)
      const page = await this.prisma.page.create({
        data: {
          workId,
          authorId: userId,
          content: dto.content,
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

      return page;
    }
  }

  async findAll(workId: string) {
    const pages = await this.prisma.page.findMany({
      where: { workId, status: 'approved' },
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

    return pages;
  }

  async findOne(workId: string, pageNumber: number) {
    const page = await this.prisma.page.findFirst({
      where: {
        workId,
        pageNumber,
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

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return page;
  }

  async update(pageId: string, userId: string, dto: UpdatePageDto) {
    // Find the page
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      include: {
        work: true,
      },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    // Only allow updates to approved pages
    if (page.status !== 'approved') {
      throw new ForbiddenException(
        'Only approved pages can be updated',
      );
    }

    // Verify user is the page author
    if (page.authorId !== userId) {
      throw new ForbiddenException('You are not the author of this page');
    }

    // Validate content length if content is being updated
    if (dto.content && dto.content.length > page.work.pageCharLimit) {
      throw new BadRequestException(
        `Content exceeds the work's character limit of ${page.work.pageCharLimit}`,
      );
    }

    // Update the page
    const updatedPage = await this.prisma.page.update({
      where: { id: pageId },
      data: {
        content: dto.content,
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

    return updatedPage;
  }

  async remove(pageId: string, userId: string) {
    // Find the page
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    // Only allow deletion of approved pages
    if (page.status !== 'approved') {
      throw new ForbiddenException(
        'Only approved pages can be deleted',
      );
    }

    // Verify user is the page author
    if (page.authorId !== userId) {
      throw new ForbiddenException('You are not the author of this page');
    }

    // Delete the page and reorder subsequent pages
    await this.prisma.$transaction(async (tx) => {
      // Delete the page
      await tx.page.delete({
        where: { id: pageId },
      });

      // Decrement pageNumber of all subsequent approved pages using a single query
      await tx.$executeRaw`
        UPDATE "Page"
        SET "pageNumber" = "pageNumber" - 1
        WHERE "workId" = ${page.workId}
        AND "pageNumber" > ${page.pageNumber}
        AND status = 'approved'
      `;
    });

    return { message: 'Page deleted successfully' };
  }

  async getPendingContributions(workId: string, ownerId: string) {
    // Verify work exists and user is owner
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
    });

    if (!work) {
      throw new NotFoundException('Work not found');
    }

    if (work.authorId !== ownerId) {
      throw new ForbiddenException(
        'Only the work owner can perform this action',
      );
    }

    // Return all pending pages for this work
    const pendingPages = await this.prisma.page.findMany({
      where: {
        workId,
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
      orderBy: { createdAt: 'asc' },
    });

    return pendingPages;
  }

  async approveContribution(pageId: string, ownerId: string) {
    // Find the page
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      include: { work: true },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    // Verify page is pending
    if (page.status !== 'pending') {
      throw new BadRequestException('Page is not pending approval');
    }

    // Verify user is the work owner
    if (page.work.authorId !== ownerId) {
      throw new ForbiddenException(
        'Only the work owner can perform this action',
      );
    }

    // Get the next available page number
    const lastPage = await this.prisma.page.findFirst({
      where: { workId: page.workId, status: 'approved' },
      orderBy: { pageNumber: 'desc' },
    });

    const nextPageNumber = lastPage ? lastPage.pageNumber + 1 : 1;

    // Update page: status = "approved", assign pageNumber, set approvedAt
    const approvedPage = await this.prisma.page.update({
      where: { id: pageId },
      data: {
        status: 'approved',
        pageNumber: nextPageNumber,
        approvedAt: new Date(),
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

    return approvedPage;
  }

  async rejectContribution(pageId: string, ownerId: string) {
    // Find the page
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      include: { work: true },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    // Verify page is pending
    if (page.status !== 'pending') {
      throw new BadRequestException('Page is not pending approval');
    }

    // Verify user is the work owner
    if (page.work.authorId !== ownerId) {
      throw new ForbiddenException(
        'Only the work owner can perform this action',
      );
    }

    // Delete the page permanently
    await this.prisma.page.delete({
      where: { id: pageId },
    });

    return { message: 'Contribution rejected and deleted successfully' };
  }
}
