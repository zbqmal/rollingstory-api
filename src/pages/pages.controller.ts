import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import type { User } from '@prisma/client';

@ApiTags('pages')
@Controller()
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Post('works/:workId/pages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new page contribution' })
  @ApiResponse({ status: 201, description: 'Page successfully created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - collaboration not allowed',
  })
  create(
    @Param('workId') workId: string,
    @GetUser() user: User,
    @Body() createPageDto: CreatePageDto,
  ) {
    return this.pagesService.create(workId, user.id, createPageDto);
  }

  @Get('works/:workId/pages')
  @ApiOperation({ summary: 'Get all approved pages for a work' })
  @ApiResponse({ status: 200, description: 'List of approved pages' })
  @ApiResponse({ status: 404, description: 'Work not found' })
  findAll(@Param('workId') workId: string) {
    return this.pagesService.findAll(workId);
  }

  @Get('works/:workId/pages/pending')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get pending page contributions (owner only)' })
  @ApiResponse({ status: 200, description: 'List of pending contributions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not owner' })
  getPending(@Param('workId') workId: string, @GetUser() user: User) {
    return this.pagesService.getPendingContributions(workId, user.id);
  }

  @Get('works/:workId/pages/:number')
  @ApiOperation({ summary: 'Get specific page by number' })
  @ApiResponse({ status: 200, description: 'Page details' })
  @ApiResponse({ status: 404, description: 'Page not found' })
  findOne(
    @Param('workId') workId: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    return this.pagesService.findOne(workId, number);
  }

  @Patch('pages/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update page (author only)' })
  @ApiResponse({ status: 200, description: 'Page successfully updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not author' })
  @ApiResponse({ status: 404, description: 'Page not found' })
  update(
    @Param('id') id: string,
    @GetUser() user: User,
    @Body() updatePageDto: UpdatePageDto,
  ) {
    return this.pagesService.update(id, user.id, updatePageDto);
  }

  @Delete('pages/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete page (author or work owner only)' })
  @ApiResponse({ status: 200, description: 'Page successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not authorized' })
  @ApiResponse({ status: 404, description: 'Page not found' })
  remove(@Param('id') id: string, @GetUser() user: User) {
    return this.pagesService.remove(id, user.id);
  }

  @Post('pages/:id/approve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Approve pending page contribution (owner only)' })
  @ApiResponse({ status: 200, description: 'Page successfully approved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not owner' })
  @ApiResponse({ status: 404, description: 'Page not found' })
  approve(@Param('id') id: string, @GetUser() user: User) {
    return this.pagesService.approveContribution(id, user.id);
  }

  @Delete('pages/:id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Reject pending page contribution (owner only)' })
  @ApiResponse({ status: 200, description: 'Page successfully rejected' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not owner' })
  @ApiResponse({ status: 404, description: 'Page not found' })
  reject(@Param('id') id: string, @GetUser() user: User) {
    return this.pagesService.rejectContribution(id, user.id);
  }

  @Get('works/:workId/collaborators')
  @ApiOperation({ summary: 'Get all collaborators for a work' })
  @ApiResponse({ status: 200, description: 'List of collaborators' })
  @ApiResponse({ status: 404, description: 'Work not found' })
  getCollaborators(@Param('workId') workId: string) {
    return this.pagesService.getCollaborators(workId);
  }
}
