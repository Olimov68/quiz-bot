import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { SessionsService } from './sessions.service.js';
import { AuthGuard } from '../auth/auth.guard.js';

@Controller('sessions')
@UseGuards(AuthGuard)
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  @Get()
  async list(@Req() req: any) {
    return this.sessionsService.listSessions(req.user.id, req.user.role);
  }

  @Post('start')
  async start(@Req() req: any, @Body() body: { quizId: string; mode?: any; groupId?: string }) {
    return this.sessionsService.createSession(req.user.id, body.quizId, body.mode, body.groupId);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.sessionsService.getSession(id);
  }

  @Get(':id/leaderboard')
  async leaderboard(@Param('id') id: string) {
    return this.sessionsService.getSessionLeaderboard(id);
  }
}
