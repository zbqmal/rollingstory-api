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
import { GetUser } from '../auth/get-user.decorator';
import type { User } from '@prisma/client';

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
  @ApiOperation({ summary: 'Get all works with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'List of works' })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.worksService.findAll(page, limit);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: "Get current user's works" })
  @ApiResponse({ status: 200, description: "List of user's works" })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findMyWorks(@GetUser() user: User) {
    return this.worksService.findMyWorks(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get work by ID' })
  @ApiResponse({ status: 200, description: 'Work details' })
  @ApiResponse({ status: 404, description: 'Work not found' })
  findOne(@Param('id') id: string) {
    return this.worksService.findOne(id);
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
}
