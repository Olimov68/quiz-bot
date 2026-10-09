import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { QuizzesService } from './quizzes.service.js';
import { AuthGuard } from '../auth/auth.guard.js';

@Controller('quizzes')
@UseGuards(AuthGuard)
export class QuizzesController {
  constructor(private quizzesService: QuizzesService) {}

  @Get()
  async list(@Req() req: any, @Query('search') search?: string) {
    return this.quizzesService.listQuizzes(req.user.id, req.user.role, search);
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @Req() req: any) {
    return this.quizzesService.getQuizById(id, req.user.id, req.user.role);
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    return this.quizzesService.createQuiz(req.user.id, body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Req() req: any, @Body() body: any) {
    return this.quizzesService.updateQuiz(id, req.user.id, req.user.role, body);
  }

  @Post(':id/duplicate')
  async duplicate(@Param('id') id: string, @Req() req: any) {
    return this.quizzesService.duplicateQuiz(id, req.user.id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.quizzesService.deleteQuiz(id, req.user.id, req.user.role);
  }
}
