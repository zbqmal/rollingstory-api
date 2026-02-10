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
      include: {
        collaborators: {
          where: {
            userId,
            approvedAt: {
              not: null,
            },
          },
        },
      },
    });

    if (!work) {
      throw new NotFoundException('Work not found');
    }

    // Check if user is owner or approved collaborator
    const isOwner = work.authorId === userId;
    const isCollaborator = work.collaborators.length > 0;

    if (!isOwner && !isCollaborator) {
      throw new ForbiddenException(
        'You are not authorized to add pages to this work',
      );
    }

    // Validate content length against work's pageCharLimit
    if (dto.content.length > work.pageCharLimit) {
      throw new BadRequestException(
        `Content exceeds the work's character limit of ${work.pageCharLimit}`,
      );
    }

    // Get the next page number
    const lastPage = await this.prisma.page.findFirst({
      where: { workId },
      orderBy: { pageNumber: 'desc' },
    });

    const nextPageNumber = lastPage ? lastPage.pageNumber + 1 : 1;

    // Create the page
    const page = await this.prisma.page.create({
      data: {
        workId,
        authorId: userId,
        content: dto.content,
        pageNumber: nextPageNumber,
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

  async findAll(workId: string) {
    const pages = await this.prisma.page.findMany({
      where: { workId },
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
    const page = await this.prisma.page.findUnique({
      where: {
        workId_pageNumber: {
          workId,
          pageNumber,
        },
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

      // Decrement pageNumber of all subsequent pages using a single query
      await tx.$executeRaw`
        UPDATE "Page"
        SET "pageNumber" = "pageNumber" - 1
        WHERE "workId" = ${page.workId}
        AND "pageNumber" > ${page.pageNumber}
      `;
    });

    return { message: 'Page deleted successfully' };
  }
}
