import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LikeResponseDto } from './dto/like-response.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class LikesService {
  constructor(private prisma: PrismaService) {}

  async likeWork(workId: string, userId: string): Promise<LikeResponseDto> {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) {
      throw new NotFoundException('Work not found');
    }

    try {
      const updatedWork = await this.prisma.$transaction(async (tx) => {
        await tx.like.create({ data: { userId, workId } });
        return tx.work.update({
          where: { id: workId },
          data: { likesCount: { increment: 1 } },
        });
      });

      return { likesCount: updatedWork.likesCount, isLiked: true };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Already liked');
      }
      throw err;
    }
  }

  async unlikeWork(workId: string, userId: string): Promise<LikeResponseDto> {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) {
      throw new NotFoundException('Work not found');
    }

    try {
      const updatedWork = await this.prisma.$transaction(async (tx) => {
        await tx.like.delete({
          where: { userId_workId: { userId, workId } },
        });
        return tx.work.update({
          where: { id: workId },
          data: { likesCount: { decrement: 1 } },
        });
      });

      return {
        likesCount: Math.max(updatedWork.likesCount, 0),
        isLiked: false,
      };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException('Like not found');
      }
      throw err;
    }
  }

  async likePage(pageId: string, userId: string): Promise<LikeResponseDto> {
    const page = await this.prisma.page.findUnique({ where: { id: pageId } });
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    if (page.status !== 'approved') {
      throw new ForbiddenException('Cannot like a pending page');
    }

    try {
      const updatedPage = await this.prisma.$transaction(async (tx) => {
        await tx.like.create({ data: { userId, pageId } });
        return tx.page.update({
          where: { id: pageId },
          data: { likesCount: { increment: 1 } },
        });
      });

      return { likesCount: updatedPage.likesCount, isLiked: true };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Already liked');
      }
      throw err;
    }
  }

  async unlikePage(pageId: string, userId: string): Promise<LikeResponseDto> {
    const page = await this.prisma.page.findUnique({ where: { id: pageId } });
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    if (page.status !== 'approved') {
      throw new ForbiddenException('Cannot unlike a pending page');
    }

    try {
      const updatedPage = await this.prisma.$transaction(async (tx) => {
        await tx.like.delete({
          where: { userId_pageId: { userId, pageId } },
        });
        return tx.page.update({
          where: { id: pageId },
          data: { likesCount: { decrement: 1 } },
        });
      });

      return {
        likesCount: Math.max(updatedPage.likesCount, 0),
        isLiked: false,
      };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException('Like not found');
      }
      throw err;
    }
  }
}
