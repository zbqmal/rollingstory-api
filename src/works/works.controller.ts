import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { WorksService } from './works.service';
import { CreateWorkDto } from './dto/create-work.dto';
import { UpdateWorkDto } from './dto/update-work.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { OptionalGetUser } from '../auth/optional-get-user.decorator';
import type { User } from '@prisma/client';
import { WORK_GENRES } from './constants';

@ApiTags('works')
@Controller('works')
export class WorksController {
  constructor(private readonly worksService: WorksService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new work/story' })
  @ApiResponse({ status: 201, description: 'Work successfully created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@GetUser() user: User, @Body() createWorkDto: CreateWorkDto) {
    return this.worksService.create(user.id, createWorkDto);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get all works with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'genre', required: false, type: String, enum: WORK_GENRES })
  @ApiResponse({ status: 200, description: 'List of works' })
  getAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('genre') genre?: string,
    @OptionalGetUser() user: User | null = null,
  ) {
    return user
      ? this.worksService.getAll(page, limit, user.id, genre)
      : this.worksService.getAll(page, limit, undefined, genre);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: "Get current user's works" })
  @ApiResponse({ status: 200, description: "List of user's works" })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMyWorks(@GetUser() user: User) {
    return this.worksService.getMyWorks(user.id);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get work by ID' })
  @ApiResponse({ status: 200, description: 'Work details' })
  @ApiResponse({ status: 404, description: 'Work not found' })
  getById(
    @Param('id') id: string,
    @OptionalGetUser() user: User | null = null,
  ) {
    return user
      ? this.worksService.getById(id, user.id)
      : this.worksService.getById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update work (owner only)' })
  @ApiResponse({ status: 200, description: 'Work successfully updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not owner' })
  @ApiResponse({ status: 404, description: 'Work not found' })
  update(
    @Param('id') id: string,
    @GetUser() user: User,
    @Body() updateWorkDto: UpdateWorkDto,
  ) {
    return this.worksService.update(id, user.id, updateWorkDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete work (owner only)' })
  @ApiResponse({ status: 200, description: 'Work successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not owner' })
  @ApiResponse({ status: 404, description: 'Work not found' })
  remove(@Param('id') id: string, @GetUser() user: User) {
    return this.worksService.remove(id, user.id);
  }

  @Get(':id/collaborators')
  @ApiOperation({ summary: 'Get all collaborators for a work' })
  @ApiResponse({ status: 200, description: 'List of collaborators' })
  @ApiResponse({ status: 404, description: 'Work not found' })
  getCollaborators(@Param('id') id: string) {
    return this.worksService.getCollaborators(id);
  }
}
