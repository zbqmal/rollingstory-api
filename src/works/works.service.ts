import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkDto } from './dto/create-work.dto';
import { UpdateWorkDto } from './dto/update-work.dto';

@Injectable()
export class WorksService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateWorkDto) {
    const work = await this.prisma.work.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type || 'novel',
        pageCharLimit: dto.pageCharLimit || 2000,
        allowCollaboration: dto.allowCollaboration ?? true,
        authorId: userId,
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

    return work;
  }

  async getAll(page: number = 1, limit: number = 10, userId?: string) {
    const skip = (page - 1) * limit;

    const [works, total] = await Promise.all([
      this.prisma.work.findMany({
        skip,
        take: limit,
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
      }),
      this.prisma.work.count(),
    ]);

    if (userId) {
      const workIds = works.map((w) => w.id);
      const likedWorks = await this.prisma.like.findMany({
        where: { userId, workId: { in: workIds } },
        select: { workId: true },
      });
      const likedSet = new Set(likedWorks.map((l) => l.workId));
      const worksWithLikes = works.map((w) => ({
        ...w,
        isLikedByCurrentUser: likedSet.has(w.id),
      }));
      return { data: worksWithLikes, total, page, limit };
    }

    return {
      data: works,
      total,
      page,
      limit,
    };
  }

  async getMyWorks(userId: string) {
    const works = await this.prisma.work.findMany({
      where: {
        authorId: userId,
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

    const workIds = works.map((w) => w.id);
    const likedWorks = await this.prisma.like.findMany({
      where: { userId, workId: { in: workIds } },
      select: { workId: true },
    });
    const likedSet = new Set(likedWorks.map((l) => l.workId));

    return works.map((w) => ({
      ...w,
      isLikedByCurrentUser: likedSet.has(w.id),
    }));
  }

  async getById(id: string, userId?: string) {
    const work = await this.prisma.work.findUnique({
      where: { id },
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

    if (!work) {
      throw new NotFoundException('Work not found');
    }

    if (userId) {
      const like = await this.prisma.like.findUnique({
        where: { userId_workId: { userId, workId: id } },
        select: { workId: true },
      });
      return { ...work, isLikedByCurrentUser: !!like };
    }

    return work;
  }

  async update(id: string, userId: string, dto: UpdateWorkDto) {
    const work = await this.prisma.work.findUnique({
      where: { id },
    });

    if (!work) {
      throw new NotFoundException('Work not found');
    }

    if (work.authorId !== userId) {
      throw new ForbiddenException('You are not the owner of this work');
    }

    const updatedWork = await this.prisma.work.update({
      where: { id },
      data: {
        ...dto,
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

    return updatedWork;
  }

  async remove(id: string, userId: string) {
    const work = await this.prisma.work.findUnique({
      where: { id },
    });

    if (!work) {
      throw new NotFoundException('Work not found');
    }

    if (work.authorId !== userId) {
      throw new ForbiddenException('You are not the owner of this work');
    }

    await this.prisma.work.delete({
      where: { id },
    });

    return { message: 'Work deleted successfully' };
  }

  async getCollaborators(workId: string) {
    // Verify work exists
    const work = await this.prisma.work.findUnique({
      where: { id: workId },
    });

    if (!work) {
      throw new NotFoundException('Work not found');
    }

    // Use query builder for efficient aggregation
    const collaborators = await this.prisma.$queryRaw<
      Array<{ userId: string; username: string; pageCount: number }>
    >`
      SELECT 
        "User"."id" as "userId",
        "User"."username" as "username",
        COUNT("Page"."id")::int as "pageCount"
      FROM "Page"
      INNER JOIN "User" ON "Page"."authorId" = "User"."id"
      WHERE "Page"."workId" = ${workId}
        AND "Page"."status" = 'approved'
      GROUP BY "User"."id", "User"."username"
      ORDER BY "pageCount" DESC, "User"."username" ASC
    `;

    // Return collaborators (already in correct format)
    return collaborators;
  }
}
