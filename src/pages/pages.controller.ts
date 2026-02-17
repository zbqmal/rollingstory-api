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
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import type { User } from '@prisma/client';

@Controller()
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Post('works/:workId/pages')
  @UseGuards(JwtAuthGuard)
  create(
    @Param('workId') workId: string,
    @GetUser() user: User,
    @Body() createPageDto: CreatePageDto,
  ) {
    return this.pagesService.create(workId, user.id, createPageDto);
  }

  @Get('works/:workId/pages')
  findAll(@Param('workId') workId: string) {
    return this.pagesService.findAll(workId);
  }

  @Get('works/:workId/pages/pending')
  @UseGuards(JwtAuthGuard)
  getPending(@Param('workId') workId: string, @GetUser() user: User) {
    return this.pagesService.getPendingContributions(workId, user.id);
  }

  @Get('works/:workId/pages/:number')
  findOne(
    @Param('workId') workId: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    return this.pagesService.findOne(workId, number);
  }

  @Patch('pages/:id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @GetUser() user: User,
    @Body() updatePageDto: UpdatePageDto,
  ) {
    return this.pagesService.update(id, user.id, updatePageDto);
  }

  @Delete('pages/:id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @GetUser() user: User) {
    return this.pagesService.remove(id, user.id);
  }

  @Post('pages/:id/approve')
  @UseGuards(JwtAuthGuard)
  approve(@Param('id') id: string, @GetUser() user: User) {
    return this.pagesService.approveContribution(id, user.id);
  }

  @Delete('pages/:id/reject')
  @UseGuards(JwtAuthGuard)
  reject(@Param('id') id: string, @GetUser() user: User) {
    return this.pagesService.rejectContribution(id, user.id);
  }

  @Get('works/:workId/collaborators')
  getCollaborators(@Param('workId') workId: string) {
    return this.pagesService.getCollaborators(workId);
  }
}
