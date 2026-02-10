import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CollaboratorsService } from './collaborators.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import type { User } from '@prisma/client';

@Controller()
export class CollaboratorsController {
  constructor(private readonly collaboratorsService: CollaboratorsService) {}

  @Post('works/:workId/collaborators/request')
  @UseGuards(JwtAuthGuard)
  requestCollaboration(
    @Param('workId') workId: string,
    @GetUser() user: User,
  ) {
    return this.collaboratorsService.requestCollaboration(workId, user.id);
  }

  @Post('works/:workId/collaborators/:userId/approve')
  @UseGuards(JwtAuthGuard)
  approveCollaborator(
    @Param('workId') workId: string,
    @Param('userId') userId: string,
    @GetUser() user: User,
  ) {
    return this.collaboratorsService.approveCollaborator(
      workId,
      userId,
      user.id,
    );
  }

  @Delete('works/:workId/collaborators/:userId')
  @UseGuards(JwtAuthGuard)
  removeCollaborator(
    @Param('workId') workId: string,
    @Param('userId') userId: string,
    @GetUser() user: User,
  ) {
    return this.collaboratorsService.removeCollaborator(
      workId,
      userId,
      user.id,
    );
  }

  @Get('works/:workId/collaborators')
  getCollaborators(@Param('workId') workId: string) {
    return this.collaboratorsService.getCollaborators(workId);
  }

  @Get('works/:workId/collaborators/pending')
  @UseGuards(JwtAuthGuard)
  getPendingRequests(
    @Param('workId') workId: string,
    @GetUser() user: User,
  ) {
    return this.collaboratorsService.getPendingRequests(workId, user.id);
  }
}
