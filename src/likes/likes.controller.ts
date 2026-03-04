import {
  Controller,
  Post,
  Delete,
  Param,
  UseGuards,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LikesService } from './likes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import type { User } from '@prisma/client';

@ApiTags('likes')
@Controller()
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post('works/:id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Like a work' })
  @ApiResponse({ status: 201, description: 'Work liked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Work not found' })
  @ApiResponse({ status: 409, description: 'Already liked' })
  likeWork(@Param('id') id: string, @GetUser() user: User) {
    return this.likesService.likeWork(id, user.id);
  }

  @Delete('works/:id/like')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Unlike a work' })
  @ApiResponse({ status: 200, description: 'Work unliked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Work not found or like not found' })
  unlikeWork(@Param('id') id: string, @GetUser() user: User) {
    return this.likesService.unlikeWork(id, user.id);
  }

  @Post('works/:workId/pages/:pageNumber/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Like a page' })
  @ApiResponse({ status: 201, description: 'Page liked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Page not found' })
  @ApiResponse({ status: 409, description: 'Already liked' })
  likePage(
    @Param('workId') workId: string,
    @Param('pageNumber', ParseIntPipe) pageNumber: number,
    @GetUser() user: User,
  ) {
    return this.likesService.likePage(workId, pageNumber, user.id);
  }

  @Delete('works/:workId/pages/:pageNumber/like')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Unlike a page' })
  @ApiResponse({ status: 200, description: 'Page unliked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Page not found or like not found' })
  unlikePage(
    @Param('workId') workId: string,
    @Param('pageNumber', ParseIntPipe) pageNumber: number,
    @GetUser() user: User,
  ) {
    return this.likesService.unlikePage(workId, pageNumber, user.id);
  }
}
